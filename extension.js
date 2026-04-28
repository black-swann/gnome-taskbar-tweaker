import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {
    arraysEqual,
    buildDefaultLayout,
    buildTargetLayout,
    CURRENT_LAYOUT_VERSION,
    flattenLayout,
    getMovableItems,
    normalizeLayoutEntries,
    parseLayoutEntry,
    prettifyItemLabel,
    SECTION_NAMES,
    serializeAvailableItem,
} from './layout.js';

export default class GnomeTaskbarTweakerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._migrateDefaultSettings();
        this._boxSignalIds = [];
        this._scheduledSyncId = null;
        this._isApplyingLayout = false;
        this._startupRetryCount = 0;

        this._settingsSignals = [
            this._settings.connect('changed::panel-layout', () => this._scheduleSync('layout-changed')),
            this._settings.connect('changed::persist-layout', () => this._scheduleSync('persist-layout-changed')),
            this._settings.connect('changed::sync-generation', () => this._syncFromPanel('manual-refresh')),
        ];

        this._connectPanelSignals();
        this._ensureSettingsVersion();
        this._scheduleSync('enable');
    }

    disable() {
        if (this._scheduledSyncId) {
            GLib.source_remove(this._scheduledSyncId);
            this._scheduledSyncId = null;
        }

        for (const signalId of this._settingsSignals ?? [])
            this._settings.disconnect(signalId);

        for (const {box, signalId} of this._boxSignalIds ?? [])
            this._safeDisconnect(box, signalId);

        this._boxSignalIds = [];
        this._settingsSignals = [];
        this._startupRetryCount = 0;
        this._settings = null;
    }

    _connectPanelSignals() {
        for (const box of Object.values(this._getSectionBoxes())) {
            if (!box)
                continue;

            this._boxSignalIds.push({
                box,
                signalId: box.connect('child-added', () => {
                    if (!this._isApplyingLayout)
                        this._scheduleSync('child-added');
                }),
            });
            this._boxSignalIds.push({
                box,
                signalId: box.connect('child-removed', () => {
                    if (!this._isApplyingLayout)
                        this._scheduleSync('child-removed');
                }),
            });
        }
    }

    _scheduleSync(reason) {
        if (this._scheduledSyncId)
            return;

        this._scheduledSyncId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._scheduledSyncId = null;
            this._syncFromPanel(reason);
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncFromPanel(reason) {
        try {
            const discoveredItems = this._discoverPanelItems();
            const movableItems = getMovableItems(discoveredItems);

            if (movableItems.length === 0) {
                if (this._shouldRetryStartupDiscovery(reason)) {
                    this._scheduleSync('startup-retry');
                    return;
                }

                this._persistAvailableItems(discoveredItems);
                this._setLastError(`No movable panel items discovered during ${reason}.`);
                return;
            }

            this._persistBaselineLayout(movableItems);

            const sanitizedLayout = this._sanitizeStoredLayout(movableItems);
            this._applyLayout(movableItems, sanitizedLayout);
            this._updateDiscoveredSections(discoveredItems, sanitizedLayout);
            this._persistAvailableItems(discoveredItems);
            this._setLastError('');
        } catch (error) {
            this._setLastError(error?.message ?? String(error));
            console.error(`[${this.uuid}] Failed to sync panel layout (${reason})`, error);
        }
    }

    _shouldRetryStartupDiscovery(reason) {
        if (!['enable', 'startup-retry'].includes(reason))
            return false;

        if (this._startupRetryCount >= 20)
            return false;

        this._startupRetryCount += 1;
        return true;
    }

    _updateDiscoveredSections(allItems, flatLayout) {
        const sectionById = new Map();
        for (const entry of flatLayout) {
            const parsed = parseLayoutEntry(entry);
            if (parsed)
                sectionById.set(parsed.id, parsed.section);
        }
        for (const item of allItems) {
            if (item.movable && sectionById.has(item.id))
                item.section = sectionById.get(item.id);
        }
    }

    _ensureSettingsVersion() {
        const version = this._settings.get_uint('layout-version');
        if (version === CURRENT_LAYOUT_VERSION)
            return;

        this._settings.set_strv('baseline-layout', []);
        this._settings.set_strv('panel-layout', []);
        this._settings.set_uint('layout-version', CURRENT_LAYOUT_VERSION);
    }

    _migrateDefaultSettings() {
        if (this._settings.get_user_value('persist-layout') !== null)
            return;

        this._settings.set_boolean('persist-layout', true);
    }

    _discoverPanelItems() {
        const statusAreaMap = this._buildStatusAreaActorMap();
        const sectionBoxes = this._getSectionBoxes();
        const discovered = [];

        for (const [section, box] of Object.entries(sectionBoxes)) {
            this._getBoxChildren(box).forEach((actor, index) => {
                const known = statusAreaMap.get(actor);
                if (known) {
                    discovered.push({
                        container: known.container,
                        id: known.id,
                        label: known.label,
                        movable: true,
                        section,
                        source: 'status-area',
                        visible: known.container.visible,
                    });
                    return;
                }

                discovered.push({
                    id: this._buildUnsupportedId(section, actor, index),
                    label: this._describeActor(actor),
                    movable: false,
                    section,
                    source: 'panel-child',
                    visible: actor.visible,
                });
            });
        }

        if (getMovableItems(discovered).length === 0)
            return this._discoverStatusAreaFallback(statusAreaMap, sectionBoxes);

        return discovered;
    }

    _discoverStatusAreaFallback(statusAreaMap, sectionBoxes) {
        const discovered = [];

        for (const known of statusAreaMap.values()) {
            discovered.push({
                container: known.container,
                id: known.id,
                label: known.label,
                movable: true,
                section: this._findContainerSection(known.container, sectionBoxes)
                    ?? this._guessStatusAreaSection(known.id),
                source: 'status-area',
                visible: known.container.visible,
            });
        }

        return discovered;
    }

    _findContainerSection(container, sectionBoxes) {
        let actor = container;
        for (let depth = 0; actor && depth < 6; depth++) {
            for (const [section, box] of Object.entries(sectionBoxes)) {
                if (actor === box)
                    return section;
            }
            actor = actor.get_parent?.();
        }

        return null;
    }

    _guessStatusAreaSection(id) {
        if (id === 'activities' || id === 'appMenu')
            return 'left';

        if (id === 'dateMenu')
            return 'center';

        return 'right';
    }

    _buildStatusAreaActorMap() {
        const actorMap = new Map();

        for (const [id, item] of Object.entries(Main.panel?.statusArea ?? {})) {
            if (!item)
                continue;

            const normalizedId = this._normalizeStatusAreaId(id);
            const label = prettifyItemLabel(normalizedId);
            const container = item.container ?? item.actor ?? item;
            if (container)
                actorMap.set(container, {id: normalizedId, label, container});
        }

        return actorMap;
    }

    _normalizeStatusAreaId(id) {
        if (!id.startsWith('appindicator-'))
            return id;

        const atIndex = id.indexOf('@/');
        if (atIndex === -1)
            return id;

        return `appindicator${id.slice(atIndex)}`;
    }

    _buildUnsupportedId(section, actor, index) {
        const name = actor.name || actor.constructor?.name || 'actor';
        const styleClass = actor.style_class || 'panel';
        const slug = `${name}-${styleClass}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        return `unsupported-${section}-${index}-${slug || 'actor'}`;
    }

    _describeActor(actor) {
        return actor.accessible_name
            || actor.name
            || actor.constructor?.name
            || 'Unsupported panel actor';
    }

    _getSectionBoxes() {
        return {
            left: Main.panel?._leftBox ?? null,
            center: Main.panel?._centerBox ?? null,
            right: Main.panel?._rightBox ?? null,
        };
    }

    _getBoxChildren(box) {
        try {
            return box?.get_children?.() ?? [];
        } catch (error) {
            console.warn(`[${this.uuid}] Skipping disposed panel section during discovery`, error);
            return [];
        }
    }

    _safeDisconnect(object, signalId) {
        try {
            object.disconnect(signalId);
        } catch (error) {
            console.warn(`[${this.uuid}] Could not disconnect panel signal`, error);
        }
    }

    _persistAvailableItems(discoveredItems) {
        const serialized = discoveredItems.map(serializeAvailableItem);
        const current = this._settings.get_strv('available-items');
        if (!arraysEqual(serialized, current))
            this._settings.set_strv('available-items', serialized);
    }

    _persistBaselineLayout(movableItems) {
        const current = this._settings.get_strv('baseline-layout');
        const normalized = normalizeLayoutEntries(current);

        if (this._settings.get_boolean('persist-layout') && normalized.length > 0)
            return;

        if (normalized.length > 0) {
            const baselineIds = new Set(normalized.map(e => parseLayoutEntry(e)?.id).filter(Boolean));
            const liveIds = new Set(movableItems.map(item => item.id));
            const unchanged = baselineIds.size === liveIds.size &&
                [...liveIds].every(id => baselineIds.has(id));
            if (unchanged)
                return;
        }

        this._settings.set_strv('baseline-layout', buildDefaultLayout(movableItems));
    }

    _sanitizeStoredLayout(movableItems) {
        const movableIds = new Set(movableItems.map(item => item.id));
        const current = this._settings.get_strv('panel-layout');
        const persistLayout = this._settings.get_boolean('persist-layout');
        const normalizedCurrent = normalizeLayoutEntries(current);
        let sanitized = normalizedCurrent.filter(entry => movableIds.has(parseLayoutEntry(entry)?.id));

        if (sanitized.length === 0)
            sanitized = normalizeLayoutEntries(this._settings.get_strv('baseline-layout'))
                .filter(entry => movableIds.has(parseLayoutEntry(entry)?.id));

        if (sanitized.length === 0)
            sanitized = buildDefaultLayout(movableItems);

        let flattenedTarget = flattenLayout(buildTargetLayout(movableItems, sanitized));

        if (persistLayout)
            flattenedTarget = this._mergePersistedLayout(normalizedCurrent, flattenedTarget);

        if (!arraysEqual(current, flattenedTarget))
            this._settings.set_strv('panel-layout', flattenedTarget);

        return flattenedTarget;
    }

    _mergePersistedLayout(savedEntries, liveEntries) {
        if (savedEntries.length === 0)
            return liveEntries;

        const liveEntryById = new Map();
        for (const entry of liveEntries) {
            const parsed = parseLayoutEntry(entry);
            if (parsed)
                liveEntryById.set(parsed.id, entry);
        }

        const merged = [];
        for (const entry of savedEntries) {
            const parsed = parseLayoutEntry(entry);
            if (!parsed)
                continue;

            if (liveEntryById.has(parsed.id)) {
                merged.push(liveEntryById.get(parsed.id));
                liveEntryById.delete(parsed.id);
            } else {
                merged.push(entry);
            }
        }

        for (const entry of liveEntries) {
            const parsed = parseLayoutEntry(entry);
            if (parsed && liveEntryById.has(parsed.id)) {
                merged.push(entry);
                liveEntryById.delete(parsed.id);
            }
        }

        return merged;
    }

    _applyLayout(movableItems, sanitizedLayout) {
        const itemsById = new Map(movableItems.map(item => [item.id, item]));
        const targetLayout = buildTargetLayout(movableItems, sanitizedLayout);
        const sectionBoxes = this._getSectionBoxes();

        this._isApplyingLayout = true;

        try {
            for (const section of SECTION_NAMES) {
                const box = sectionBoxes[section];
                const targetItems = targetLayout[section]
                    .map(id => itemsById.get(id))
                    .filter(Boolean);

                targetItems.forEach((item, index) => {
                    const container = item.container;
                    if (!container || !box)
                        return;

                    try {
                        this._removeActorFromParent(container);
                        box.insert_child_at_index(container, section === 'right' ? -1 : index);
                    } catch (error) {
                        console.warn(`[${this.uuid}] Skipping disposed panel actor during layout apply`, error);
                    }
                });
            }
        } finally {
            this._isApplyingLayout = false;
        }
    }

    _removeActorFromParent(actor) {
        try {
            const parent = actor?.get_parent?.();
            if (parent)
                parent.remove_child(actor);
        } catch (error) {
            console.warn(`[${this.uuid}] Could not remove panel actor from parent`, error);
        }
    }

    _setLastError(message) {
        if (this._settings && this._settings.get_string('last-error') !== message)
            this._settings.set_string('last-error', message);
    }
}
