import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    buildTargetLayout,
    formatSectionTitle,
    getMovableItems,
    moveItemInLayout,
    parseAvailableItems,
    SECTION_NAMES,
} from './layout.js';

class TaskbarTweakerPage extends Adw.PreferencesPage {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super({
            title: 'Panel Layout',
            icon_name: 'view-list-symbolic',
        });

        this._settings = settings;
        this._listBoxes = new Map();

        this._controlsGroup = new Adw.PreferencesGroup({
            title: 'Controls',
            description: 'Refresh detected panel items or reset the layout, then move items between sections.',
        });
        this.add(this._controlsGroup);
        this._buildControlRows();

        for (const section of SECTION_NAMES) {
            const group = new Adw.PreferencesGroup({
                title: `${formatSectionTitle(section)} Section`,
            });
            const listBox = this._createListBox();
            group.add(listBox);
            this._listBoxes.set(section, listBox);
            this.add(group);
        }

        this._signalIds = [
            this._settings.connect('changed::available-items', () => this._refresh()),
            this._settings.connect('changed::panel-layout', () => this._refresh()),
            this._settings.connect('changed::baseline-layout', () => this._refresh()),
        ];

        this.connect('destroy', () => {
            for (const signalId of this._signalIds)
                this._settings.disconnect(signalId);
        });

        this._refresh();
    }

    _buildControlRows() {
        const refreshRow = new Adw.ActionRow({
            title: 'Refresh Panel Items',
            subtitle: 'Re-scan the current panel if the item list looks stale.',
        });
        const refreshButton = new Gtk.Button({
            label: 'Refresh',
            valign: Gtk.Align.CENTER,
        });
        refreshButton.connect('clicked', () => this._requestRefresh());
        refreshRow.add_suffix(refreshButton);
        refreshRow.activatable_widget = refreshButton;
        this._controlsGroup.add(refreshRow);

        const resetRow = new Adw.ActionRow({
            title: 'Reset Layout',
            subtitle: 'Restore the original detected order of movable items.',
        });
        const resetButton = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
        });
        resetButton.connect('clicked', () => this._resetLayout());
        resetRow.add_suffix(resetButton);
        resetRow.activatable_widget = resetButton;
        this._controlsGroup.add(resetRow);

        const persistRow = new Adw.SwitchRow({
            title: 'Persist Layout Across Logins',
            subtitle: 'Keep saved positions for items that load later so your taskbar order survives logout and login.',
        });
        this._settings.bind('persist-layout', persistRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._controlsGroup.add(persistRow);
    }

    _refresh() {
        const movableItems = getMovableItems(parseAvailableItems(this._settings.get_strv('available-items')));
        const itemsById = new Map(movableItems.map(item => [item.id, item]));
        const layout = buildTargetLayout(movableItems, this._settings.get_strv('panel-layout'));

        for (const section of SECTION_NAMES) {
            const listBox = this._listBoxes.get(section);
            this._clearListBox(listBox);

            const ids = layout[section];
            if (ids.length === 0) {
                listBox.append(new Adw.ActionRow({
                    title: 'No movable items in this section',
                    subtitle: 'Either the extension has not synchronized yet, or no movable statusArea items are currently present here.',
                }));
                continue;
            }

            ids.forEach((id, index) => {
                const item = itemsById.get(id);
                if (item)
                    listBox.append(this._buildItemRow(item, section, index, ids.length));
            });
        }
    }

    _buildItemRow(item, currentSection, index, sectionLength) {
        const row = new Adw.ActionRow({
            title: item.label,
            subtitle: formatSectionTitle(currentSection),
        });

        row.add_suffix(this._buildActionButton('Left', currentSection !== 'left', () => this._moveItem(item.id, 'left')));
        row.add_suffix(this._buildActionButton('Up', index > 0, () => this._moveItem(item.id, 'up')));
        row.add_suffix(this._buildActionButton('Down', index < sectionLength - 1, () => this._moveItem(item.id, 'down')));
        row.add_suffix(this._buildActionButton('Right', currentSection !== 'right', () => this._moveItem(item.id, 'right')));

        return row;
    }

    _buildActionButton(label, sensitive, callback) {
        const button = new Gtk.Button({
            label,
            sensitive,
            valign: Gtk.Align.CENTER,
        });
        button.connect('clicked', callback);
        return button;
    }

    _moveItem(itemId, operation) {
        const movableItems = getMovableItems(parseAvailableItems(this._settings.get_strv('available-items')));
        const nextLayout = moveItemInLayout(
            movableItems,
            this._settings.get_strv('panel-layout'),
            itemId,
            operation);
        this._settings.set_strv('panel-layout', nextLayout);
    }

    _requestRefresh() {
        this._settings.set_uint('sync-generation', this._settings.get_uint('sync-generation') + 1);
    }

    _resetLayout() {
        this._settings.set_strv('panel-layout', this._settings.get_strv('baseline-layout'));
    }

    _createListBox() {
        return new Gtk.ListBox({
            css_classes: ['boxed-list'],
            selection_mode: Gtk.SelectionMode.NONE,
        });
    }

    _clearListBox(listBox) {
        let child = listBox.get_first_child();
        while (child) {
            listBox.remove(child);
            child = listBox.get_first_child();
        }
    }
}

export default class TaskbarTweakerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_title('GNOME Taskbar Tweaker');
        window.set_default_size(840, 680);
        window.add(new TaskbarTweakerPage(this.getSettings()));
    }
}
