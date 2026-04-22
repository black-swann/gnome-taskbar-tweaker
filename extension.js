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
        this._originalState = new Map();
        this._boxSignalIds = [];
        this._scheduledSyncId = null;
        this._isApplyingLayout = false;

        this._settingsSignals = [
            this._settings.connect('changed::panel-layout', () => this._scheduleSync('layout-changed')),
            this._settings.connect('changed::sync-generation', () => this._scheduleSync('manual-refresh')),
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
            box.disconnect(signalId);

        this._restoreOriginalState();

        this._boxSignalIds = [];
        this._settingsSignals = [];
        this._originalState?.clear();
        this._originalState = null;
        this._settings = null;
    }

    _connectPanelSignals() {
        for (const box of Object.values(this._getSectionBoxes())) {
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

        this._scheduledSyncId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 75, () => {
            this._scheduledSyncId = null;
            this._syncFromPanel(reason);
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncFromPanel(reason) {
        try {
            const discoveredItems = this._discoverPanelItems();
            const movableItems = getMovableItems(discoveredItems);

            this._captureOriginalState(movableItems);
            this._persistBaselineLayout(movableItems);

            const sanitizedLayout = this._sanitizeStoredLayout(movableItems);
            if (movableItems.length === 0) {
                this._persistAvailableItems(discoveredItems);
                this._setLastError(`No movable panel items discovered during ${reason}.`);
                return;
            }

            this._applyLayout(movableItems, sanitizedLayout);
            this._updateDiscoveredSections(discoveredItems, sanitizedLayout);
            this._persistAvailableItems(discoveredItems);
            this._setLastError('');
        } catch (error) {
            this._setLastError(error?.message ?? String(error));
            console.error(`[${this.uuid}] Failed to sync panel layout (${reason})`, error);
        }
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

    _discoverPanelItems() {
        const statusAreaMap = this._buildStatusAreaActorMap();
        const sectionBoxes = this._getSectionBoxes();
        const discovered = [];

        for (const [section, box] of Object.entries(sectionBoxes)) {
            box.get_children().forEach((actor, index) => {
                const known = statusAreaMap.get(actor);
                if (known) {
                    discovered.push({
                        actor: known.container,
                        container: known.container,
                        id: known.id,
                        label: known.label,
                        movable: true,
                        section,
                        statusItem: known.statusItem,
                        source: 'status-area',
                        visible: known.container.visible,
                    });
                    return;
                }

                discovered.push({
                    actor,
                    id: this._buildUnsupportedId(section, actor, index),
                    label: this._describeActor(actor),
                    movable: false,
                    section,
                    source: 'panel-child',
                    visible: actor.visible,
                });
            });
        }

        return discovered;
    }

    _buildStatusAreaActorMap() {
        const actorMap = new Map();

        for (const [id, item] of Object.entries(Main.panel.statusArea)) {
            if (!item)
                continue;

            const normalizedId = this._normalizeStatusAreaId(id);
            const label = prettifyItemLabel(normalizedId);
            const container = item.container ?? item.actor ?? item;
            if (container)
                actorMap.set(container, {id: normalizedId, label, statusItem: item, container});
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
            left: Main.panel._leftBox,
            center: Main.panel._centerBox,
            right: Main.panel._rightBox,
        };
    }

    _captureOriginalState(movableItems) {
        for (const item of movableItems) {
            if (this._originalState.has(item.id))
                continue;

            const parent = item.container.get_parent();
            const index = parent ? parent.get_children().indexOf(item.container) : -1;
            this._originalState.set(item.id, {
                id: item.id,
                actor: item.container,
                index,
                parent,
                section: item.section,
                statusItem: item.statusItem,
                visible: item.container.visible,
            });
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
        let sanitized = normalizeLayoutEntries(current).filter(entry => movableIds.has(parseLayoutEntry(entry)?.id));

        if (sanitized.length === 0)
            sanitized = normalizeLayoutEntries(this._settings.get_strv('baseline-layout'))
                .filter(entry => movableIds.has(parseLayoutEntry(entry)?.id));

        if (sanitized.length === 0)
            sanitized = buildDefaultLayout(movableItems);

        const flattenedTarget = flattenLayout(buildTargetLayout(movableItems, sanitized));

        if (!arraysEqual(current, flattenedTarget))
            this._settings.set_strv('panel-layout', flattenedTarget);

        return flattenedTarget;
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
                    if (!container)
                        return;

                    this._removeActorFromParent(container);

                    box.insert_child_at_index(container, section === 'right' ? -1 : index);
                });
            }
        } finally {
            this._isApplyingLayout = false;
        }
    }

    _restoreOriginalState() {
        const originals = [...(this._originalState?.values() ?? [])]
            .filter(state => state.actor && state.parent)
            .sort((a, b) => a.index - b.index);

        for (const state of originals) {
            this._removeActorFromParent(state.actor);
            state.parent.insert_child_at_index(state.actor, state.index);
            state.actor.visible = state.visible;
        }
    }

    _removeActorFromParent(actor) {
        const parent = actor?.get_parent?.();
        if (parent)
            parent.remove_child(actor);
    }

    _setLastError(message) {
        if (this._settings && this._settings.get_string('last-error') !== message)
            this._settings.set_string('last-error', message);
    }
}
