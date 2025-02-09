import * as React from "react";
import DataViewTable = powerbi.DataViewTable;
import DataViewTableRow = powerbi.DataViewTableRow;

import Box from '@mui/material/Box';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useTreeViewApiRef } from '@mui/x-tree-view/hooks/useTreeViewApiRef';
import TextField from '@mui/material/TextField';

//https://mui.com/material-ui/react-table/

type NestedJSON = {
    [key: string]: NestedJSON | Record<string, never>;
};

export interface ISQExprFull extends powerbi.data.ISQExpr { ref: string, source: { entity: string } }

export const SEP = "##"
export const PARENT_SEP = ":@&:"


function convertFlatTableToNestedJSON(table: DataViewTableRow[]): [NestedJSON[], { [key: string]: string },] {
    const nestedRows: NestedJSON[] = [];
    const initJSON: NestedJSON = {};
    const leafToIdMapping: { [key: string]: string } = {}
    initJSON[table[0][0].toString()] = {}
    nestedRows.push(initJSON)

    table.forEach(row => {
        const previousNestedRow = nestedRows[nestedRows.length - 1]
        // check if previous row's root has same first value as current row's root
        // if not, we need to create a new root in our array of trees
        if (!previousNestedRow[row[0].toString()]) {
            const initJSON: NestedJSON = {};
            initJSON[row[0].toString()] = {}
            nestedRows.push(initJSON)
        }
        const currentNestedRow = nestedRows[nestedRows.length - 1]
        let level = currentNestedRow[row[0].toString()];
        let parentKey = row[0].toString()

        // Traverse or create the structure for current row keys
        for (let i = 1; i < row.length; i++) {
            const key = row[i].toString();
            // assume that either:
            // - The last column is a 'hidden id' that maps 1 to 1 with the leaf
            // - The hierarchy is ragged and thus columns are empty or repeated after some level (except the last level which contains the 'hidden id')
            // If supporting a hierarchy without 'hidden id' is ever needed, we could parametrize this '|| i == row.length - 1' to
            // avoid this 'break'. It could be done via an exposed parameter like for multi-select.
            if (parentKey === key || !key || i == row.length - 1) {
                // do now show nodes if descriptions is the same as parent node
                // or nodes that have no descriptions
                const id: string = (row[row.length - 1] || key || parentKey).toString()
                // Edge cases like row[row.length - 1] is (unexpectedly) empty, parentKey and key are both empty result in no-op
                // mapping like leafToIdMapping["1##"] = "" or leafToIdMapping["1##smth"] = "smth"
                const uniqueItemIdArr = Array(i - 1)
                for (let j = 0; j < i; j++) {
                    uniqueItemIdArr[j] = `${j}${SEP}${row[j]}`
                }
                leafToIdMapping[uniqueItemIdArr.join(PARENT_SEP)] = id
                break
            }

            if (!level[key]) {
                level[key] = {};
            }

            if (typeof level[key] !== 'object' || Array.isArray(level[key])) {
                throw new Error('Unexpected structure in nested JSON');
            }

            // Move deeper into the structure
            level = level[key] as NestedJSON;
            parentKey = key
        }
    });

    return [nestedRows, leafToIdMapping]
}


function depthFirstAddItem(obj: NestedJSON, depth: number, parentId: string) {
    // depth is the same as column index
    if (Object.keys(obj).length === 0) { return null }
    const items = []
    for (const desc in obj) {
        let itemId = `${parentId}${PARENT_SEP}${depth}${SEP}${desc}`
        if (!parentId) {
            itemId = `${depth}${SEP}${desc}`
        }
        items.push(
            <TreeItem itemId={itemId} label={desc}>
                {depthFirstAddItem(obj[desc], depth + 1, itemId)}
            </TreeItem>
        )
    }
    return items
}

function lazySearchItem(obj: NestedJSON[], query: string): [NestedJSON[], string[]] {
    // depth first search to get the highest search match in the hierarchy
    const queryLower = query.toLowerCase()
    const newObj: NestedJSON[] = []
    const matches: string[] = []
    for (const item of obj) {
        const key = Object.keys(item)[0]
        if (key.toLowerCase().includes(queryLower)) {
            matches.push(`0${SEP}${key}`)
            newObj.push(item)
            continue
        }
        const currentObj: NestedJSON = { [key]: {} }
        const match = depthFirstSearch(item[key], queryLower, currentObj[key], 1, matches)
        if (match) {
            newObj.push(currentObj)
        }
    }
    return [newObj, matches]
}

function depthFirstSearch(obj: NestedJSON, queryLower: string, currentObj: NestedJSON, depth: number, matches: string[]): boolean {
    if (Object.keys(obj).length === 0) {
        // Return false to indicate no match found
        return false
    }
    let matchFound = false
    for (const key in obj) {
        if (key.toLowerCase().includes(queryLower)) {
            // if match is found, stop searching deeper and add current object
            matches.push(`${depth}${SEP}${key}`)
            currentObj[key] = obj[key]
            matchFound = true
            continue
        }
        currentObj[key] = {}
        const match = depthFirstSearch(obj[key], queryLower, currentObj[key], depth + 1, matches)
        if (!match) {
            delete currentObj[key]
        }
        matchFound = matchFound || match
    }
    return matchFound
}


type ItemMapping = { [key: string]: string[] }

type HandleFilterFunction = (itemId: string, isSelected: boolean, ids: string[]) => void


function getParentIdsFromItemId(itemId: string): string[] {
    const splitItem = itemId.split(PARENT_SEP)
    const parentIds = Array(splitItem.length - 1)
    for (let i = 0; i < splitItem.length - 1; i++) {
        parentIds[i] = splitItem.slice(0, i + 1).join(PARENT_SEP)
    }
    return parentIds
}

function getItemChildMapping(obj: NestedJSON[]): [ItemMapping, ItemMapping] {
    // depth first search to create the list of children for each node
    const itemChildMapping = {}
    const itemLeafMapping = {}
    for (const item of obj) {
        const key = Object.keys(item)[0]
        const rootItemId = `0${SEP}${key}`
        itemLeafMapping[rootItemId] = []
        depthFirstCreateLeafMapping(item[key], rootItemId, itemChildMapping, itemLeafMapping, 1)
    }
    return [itemChildMapping, itemLeafMapping]
}

function depthFirstCreateLeafMapping(obj: NestedJSON, parentId: string, itemChildMapping: ItemMapping, itemLeafMapping: ItemMapping, depth: number) {
    const parentIds = getParentIdsFromItemId(parentId)
    parentIds.push(parentId)
    if (Object.keys(obj).length === 0) {
        const leaf = parentId
        if (!itemChildMapping[leaf]) {
            itemChildMapping[leaf] = []
        }
        for (let index = 0; index < parentIds.length - 1; index++) { // exclude the leaf via < instead of <=
            const parentId = parentIds[index]
            itemLeafMapping[parentId].push(leaf) // add curent leave in all parents
        }
        return
    }
    for (const key in obj) {
        const uniqueKey = `${parentId}${PARENT_SEP}${depth}${SEP}${key}`
        if (!itemLeafMapping[uniqueKey]) {
            itemLeafMapping[uniqueKey] = []
        }
        for (const parentId of parentIds) {
            if (!itemChildMapping[parentId]) {
                itemChildMapping[parentId] = []
            }
            itemChildMapping[parentId].push(uniqueKey) // add curent leave in all parents
        }
        depthFirstCreateLeafMapping(obj[key], uniqueKey, itemChildMapping, itemLeafMapping, depth + 1)
    }
}

export default function CollapsibleSlicer(props: { height: number, selectedItems: string[], slicerSettings: any, table: DataViewTable, handleFilter: HandleFilterFunction }) {
    const { height, selectedItems, slicerSettings, table, handleFilter } = props;
    if (table.rows.length === 0) {
        return <Box>No data</Box>
    }
    const [nestedTable, leafToIdMapping] = convertFlatTableToNestedJSON(table.rows)
    const [filteredItems, setFilteredItems] = React.useState(nestedTable);
    const toggledItemRef = React.useRef<{ [itemId: string]: boolean }>({});
    const [itemChildMapping, itemLeafMapping] = getItemChildMapping(nestedTable)
    const expandedSelectedItems: string[] = []
    const visibleSelectedItemsInit: string[] = []
    const idToLeafMapping: { [key: string]: string } = {}
    for (const leaf in leafToIdMapping) {
        idToLeafMapping[leafToIdMapping[leaf]] = leaf
    }
    for (const id of selectedItems) {
        const visibleLeafId = idToLeafMapping[id]
        const parentIds = getParentIdsFromItemId(visibleLeafId)
        for (const parentId of parentIds) {
            expandedSelectedItems.push(parentId)
        }
        visibleSelectedItemsInit.push(visibleLeafId)
    }
    const [visibleSelectedItems, setVisibleSelectedItems] = React.useState(visibleSelectedItemsInit);
    const [expandedItems, setExpendedItems] = React.useState(expandedSelectedItems);
    const apiRef = useTreeViewApiRef();

    const handleItemSelectionToggle = (
        event: React.SyntheticEvent,
        itemId: string,
        isSelected: boolean,
    ) => {
        if (Array.isArray(itemId)) {
            // From experience, handleItemSelectionToggle is always called twice:
            // - once where itemId is the array of all selected values
            // - once where itemId is only the item that was clicked by the user (with isSelected defining if it was added or removed) => we only want to cater for this call
            return
        }
        console.log("Selected Item:", itemId, "isSelected?", isSelected)
        // this apiRef.current was not working because PBI silences some error, among which the 'duplicate idemId' error, which was 
        // fixed in the meantime so now it should work and could be used if it simplify our flow/logic
        // const curr: any = apiRef.current
        const ids = []
        if (itemLeafMapping[itemId].length === 0) {
            console.log("No children, selected ID:", leafToIdMapping[itemId])
            ids.push(leafToIdMapping[itemId])
        }
        else {
            for (const leaf of itemLeafMapping[itemId]) {
                ids.push(leafToIdMapping[leaf])
            }
            console.log("Selected children Ids:", ids)
        }
        toggledItemRef.current[itemId] = isSelected;
        handleFilter(itemId, isSelected, ids)
    };

    const contolledSelectedItemsChange = (
        event: React.SyntheticEvent,
        itemIds: string | string[],
    ) => {
        // logic copied from https://mui.com/x/react-tree-view/rich-tree-view/selection/#parent-children-selection-relationship
        // until it's supported by the Team directly
        let selected = []
        if (Array.isArray(itemIds)) {
            selected = itemIds
        }
        else { selected.push(itemIds) }
        console.log("CONTROLLED:", itemIds)

        // TODO: Fix the fact that selecting a node when the hierarchy is filtered shows the parent to be selected where actally only the child should
        // be selected because the rest is 'hidden'

        // Select / unselect the children of the toggled item
        const itemsToSelect: string[] = [];
        const itemsToUnSelect: { [itemId: string]: boolean } = {};
        Object.entries(toggledItemRef.current).forEach(([itemId, isSelected]) => {
            if (isSelected) {
                itemsToSelect.push(...itemChildMapping[itemId]);
            } else {
                itemsToUnSelect[itemId] = true
                itemChildMapping[itemId].forEach((childId) => {
                    itemsToUnSelect[childId] = true;
                });
            }
        });

        const newSelectedItemsWithChildren = Array.from(
            new Set(
                [...selected, ...itemsToSelect].filter(
                    (itemId) => !itemsToUnSelect[itemId],
                ),
            ),
        );

        setVisibleSelectedItems(newSelectedItemsWithChildren);
        toggledItemRef.current = {}
    };

    const filterItem = (event: React.ChangeEvent<HTMLInputElement>) => {
        const [newNestedJson, matches] = lazySearchItem(nestedTable, event.target.value)
        console.log("Search MATCHES?", matches)
        const expandedMatches: Set<string> = new Set()
        for (const itemId of matches) {
            const parentIds = getParentIdsFromItemId(itemId)
            for (const parentId of parentIds) {
                // only expand 'parents' of the matches but not the matches themselves
                expandedMatches.add(parentId)
            }
        }
        setFilteredItems(newNestedJson)
        setExpendedItems(Array.from(expandedMatches))
    }


    return (
        <Box sx={{ paddingTop: 1, minWidth: 250, maxHeight: height, overflow: 'scroll' }}>
            <TextField onChange={filterItem} size="small" id="outlined-search" label="Search" type="search" />
            <SimpleTreeView expandedItems={expandedItems}
                onExpandedItemsChange={(_, itemIds) => setExpendedItems(itemIds)}
                selectedItems={visibleSelectedItems}
                multiSelect={slicerSettings.multiSelect.value}
                onSelectedItemsChange={contolledSelectedItemsChange}
                checkboxSelection
                apiRef={apiRef}
                onItemSelectionToggle={handleItemSelectionToggle}
            >
                {filteredItems.map(obj => depthFirstAddItem(obj, 0, ""))}
            </SimpleTreeView>

        </Box >
    );
}


export const initialState = {
    width: 440,
    height: 440,
    table: null,
    selectedItems: [],
    slicerSettings: { multiSelect: { value: false } },
    handleFilter: null,
}


export class ReactPBIHierarchySlicer extends React.Component<any, any> {
    constructor(props: any) {
        super(props);
        this.state = initialState;
    }

    public state = initialState;

    public componentWillMount() {
        console.log("componentWillMount")
        this.setState(this.props);
    }

    public componentWillUnmount() {
        console.log("componentWillUnmount")
    }

    render() {
        console.log("RERENDER")
        const { height, table, selectedItems, slicerSettings, handleFilter } = this.state;
        console.log("MULTISELECT?", slicerSettings.multiSelect.value)

        return <CollapsibleSlicer height={height} selectedItems={selectedItems} slicerSettings={slicerSettings} table={table} handleFilter={handleFilter} />
    }
}

