export const CURRENT_LAYOUT_VERSION = 2;
export const SECTION_NAMES = ['left', 'center', 'right'];
export const SECTION_TITLES = {
    left: 'Left',
    center: 'Center',
    right: 'Right',
};

const LABEL_OVERRIDES = {
    a11y: 'Accessibility',
    activities: 'Activities',
    appMenu: 'App Menu',
    dateMenu: 'Clock / Calendar',
    keyboard: 'Keyboard',
    quickSettings: 'Quick Settings',
    screenRecording: 'Screen Recording',
};

export function isValidSection(section) {
    return SECTION_NAMES.includes(section);
}

export function formatSectionTitle(section) {
    return SECTION_TITLES[section] ?? section;
}

export function normalizeLayoutEntries(entries) {
    const normalized = [];
    const seen = new Set();

    for (const entry of entries) {
        if (typeof entry !== 'string')
            continue;

        const separatorIndex = entry.indexOf(':');
        if (separatorIndex <= 0 || separatorIndex === entry.length - 1)
            continue;

        const section = entry.slice(0, separatorIndex);
        const id = entry.slice(separatorIndex + 1);
        const compositeId = `${section}:${id}`;

        if (!isValidSection(section) || seen.has(compositeId))
            continue;

        seen.add(compositeId);
        normalized.push(compositeId);
    }

    return normalized;
}

export function parseLayoutEntry(entry) {
    if (typeof entry !== 'string')
        return null;

    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1)
        return null;

    const section = entry.slice(0, separatorIndex);
    const id = entry.slice(separatorIndex + 1);
    if (!isValidSection(section) || !id)
        return null;

    return {section, id};
}

export function flattenLayout(layoutBySection) {
    return SECTION_NAMES.flatMap(section =>
        (layoutBySection[section] ?? []).map(id => `${section}:${id}`));
}

export function buildTargetLayout(items, storedEntries) {
    const movableItems = getMovableItems(items);
    const itemsById = new Map(movableItems.map(item => [item.id, item]));
    const target = {
        left: [],
        center: [],
        right: [],
    };
    const seenIds = new Set();

    for (const entry of normalizeLayoutEntries(storedEntries)) {
        const parsed = parseLayoutEntry(entry);
        if (!parsed || !itemsById.has(parsed.id) || seenIds.has(parsed.id))
            continue;

        target[parsed.section].push(parsed.id);
        seenIds.add(parsed.id);
    }

    for (const item of movableItems) {
        if (seenIds.has(item.id))
            continue;

        target[item.section].push(item.id);
        seenIds.add(item.id);
    }

    return target;
}

export function serializeAvailableItem(item) {
    return JSON.stringify({
        id: item.id,
        label: item.label,
        movable: Boolean(item.movable),
        section: item.section,
        source: item.source,
        visible: Boolean(item.visible),
    });
}

export function parseAvailableItems(entries) {
    return entries.flatMap(entry => {
        try {
            const item = JSON.parse(entry);
            if (!item || typeof item.id !== 'string' || typeof item.label !== 'string')
                return [];
            if (!isValidSection(item.section))
                return [];

            return [{
                id: item.id,
                label: item.label,
                movable: Boolean(item.movable),
                section: item.section,
                source: typeof item.source === 'string' ? item.source : 'unknown',
                visible: Boolean(item.visible),
            }];
        } catch (_error) {
            return [];
        }
    });
}

export function getMovableItems(items) {
    return items.filter(item => item.movable);
}

export function arraysEqual(a, b) {
    if (a.length !== b.length)
        return false;

    return a.every((value, index) => value === b[index]);
}

export function prettifyItemLabel(id) {
    if (LABEL_OVERRIDES[id])
        return LABEL_OVERRIDES[id];

    return id
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replaceAll('-', ' ')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

export function buildDefaultLayout(items) {
    return flattenLayout(buildTargetLayout(items, []));
}

export function moveItemInLayout(items, storedEntries, itemId, operation) {
    const target = buildTargetLayout(items, storedEntries);
    let currentSection = null;

    for (const section of SECTION_NAMES) {
        const index = target[section].indexOf(itemId);
        if (index !== -1) {
            currentSection = section;
            break;
        }
    }

    if (!currentSection)
        return flattenLayout(target);

    const currentSectionIndex = SECTION_NAMES.indexOf(currentSection);
    const sourceItems = target[currentSection];
    const sourceIndex = sourceItems.indexOf(itemId);

    switch (operation) {
    case 'up':
        if (sourceIndex > 0)
            [sourceItems[sourceIndex - 1], sourceItems[sourceIndex]] = [sourceItems[sourceIndex], sourceItems[sourceIndex - 1]];
        break;
    case 'down':
        if (sourceIndex !== -1 && sourceIndex < sourceItems.length - 1)
            [sourceItems[sourceIndex], sourceItems[sourceIndex + 1]] = [sourceItems[sourceIndex + 1], sourceItems[sourceIndex]];
        break;
    case 'left':
    case 'right': {
        const delta = operation === 'left' ? -1 : 1;
        const targetSection = SECTION_NAMES[currentSectionIndex + delta];
        if (!targetSection)
            break;

        sourceItems.splice(sourceIndex, 1);
        const destinationItems = target[targetSection];
        const destinationIndex = Math.min(sourceIndex, destinationItems.length);
        destinationItems.splice(destinationIndex, 0, itemId);
        break;
    }
    }

    return flattenLayout(target);
}
