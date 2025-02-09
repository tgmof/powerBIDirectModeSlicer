"use strict";
import * as React from "react";
import { createRoot, Root } from 'react-dom/client';
import powerbi from "powerbi-visuals-api";
import { BasicFilter, IBasicFilter } from "powerbi-models";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./settings";

import IViewport = powerbi.IViewport;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import FormattingModel = powerbi.visuals.FormattingModel

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost

import ISelectionIdBuilder = powerbi.extensibility.ISelectionIdBuilder
import ISelectionManager = powerbi.extensibility.ISelectionManager

import { ReactPBIHierarchySlicer } from "./hierarchySlicer";
import "./../style/visual.less";

export class Visual implements IVisual {
    private target: HTMLElement;
    private viewport: IViewport;
    private previousRender: { [key: string]: string | number | boolean | string[] }
    private columns: DataViewMetadataColumn[];
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private reactRoot: Root;
    private reactElement: React.ReactElement;
    private selectedData: Set<string>
    private host: IVisualHost;

    // SelectionBuilder and Managers are used to save bookmarks:
    // https://learn.microsoft.com/en-us/power-bi/developer/visuals/bookmarks-support#use-selectionmanager-to-restore-bookmark-selections
    private selectionIdBuilder: ISelectionIdBuilder
    private selectionManager: ISelectionManager;
    //--------------------

    constructor(options: VisualConstructorOptions) {
        this.handleFilter = this.handleFilter.bind(this);
        this.target = options.element;
        this.host = options.host;
        this.columns = [];
        this.previousRender = {}
        this.selectedData = new Set();
        this.formattingSettingsService = new FormattingSettingsService();
        this.selectionIdBuilder = options.host.createSelectionIdBuilder();
        this.selectionManager = options.host.createSelectionManager();
    }

    private handleFilter(itemId: string, isSelected: boolean, ids: string[]) {
        // TODO: PowerBI hast a limitation that cause it to break when the dynamic Parameter reaches around 10'000 characters.
        // Use an array of struct like this  [STRUCT([""] as node),STRUCT(["a", "V"]), ..., STRUCT(["a", "V"])] as field made of 10 items
        // to compute the pchDescription0,1,...9 and find the minimal representation of the filter
        if (itemId.length === 0) {
            return
        }
        const filterValues: string[] = []

        if (!isSelected) {
            for (const id of ids) {
                this.selectedData.delete(id)
            }
        }
        else {
            for (const id of ids) {
                this.selectedData.add(id)
            }
        }
        for (const child of this.selectedData) {
            filterValues.push(child)
        }
        filterValues.sort()
        console.log("Filter sent:", filterValues)

        if (filterValues.length === 0) {
            this.host.applyJsonFilter(null, "general", "filter", powerbi.FilterAction.merge)
        }
        else {
            const tableColumn = this.columns[this.columns.length - 1].queryName
            const [table, column] = tableColumn.split(".")
            const filter: IBasicFilter = {
                $schema: "https://powerbi.com/product/schema#basic",
                ...new BasicFilter({ table: table, column: column }, "In", filterValues)
            }
            this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge)
        }
    }

    public getFormattingModel(): FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public update(options: VisualUpdateOptions) {
        console.log("PBI Input Data", options)
        if (!options ||
            !options.dataViews ||
            !options.dataViews[0] ||
            !options.viewport) {
            return;
        }
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        console.log("multiSelect?", this.formattingSettings.slicerSettings.multiSelect.value)
        console.log("options:", options)
        if (Object.keys(this.previousRender).length === 0) {
            const rows = options.dataViews[0].table.rows
            this.columns = options.dataViews[0].table.columns
            this.previousRender["slicerSettings.multiSelect"] = this.formattingSettings.slicerSettings.multiSelect.value
            this.previousRender["viewport.height"] = Math.round(options.viewport.height * 10000) / 10000
            this.previousRender["table.rows.length"] = rows.length
            this.previousRender["table.rows.0.0"] = rows[0][0].toString()
            this.previousRender["table.rows.0.max"] = rows[0][rows[0].length - 1].toString()
            this.previousRender["table.rows.max.0"] = rows[rows.length - 1][0].toString()
            this.previousRender["table.rows.0.max"] = rows[0][rows[0].length - 1].toString()
        }
        else {
            const rows = options.dataViews[0].table.rows
            let allSame = true
            allSame &&= this.previousRender["slicerSettings.multiSelect"] === this.formattingSettings.slicerSettings.multiSelect.value
            allSame &&= this.previousRender["viewport.height"] === Math.round(options.viewport.height * 10000) / 10000
            allSame &&= this.previousRender["table.rows.length"] === rows.length
            allSame &&= this.previousRender["table.rows.0.0"] === rows[0][0].toString()
            allSame &&= this.previousRender["table.rows.0.max"] === rows[0][rows[0].length - 1].toString()
            allSame &&= this.previousRender["table.rows.max.0"] === rows[rows.length - 1][0].toString()
            allSame &&= this.previousRender["table.rows.0.max"] === rows[0][rows[0].length - 1].toString()
            if (allSame) {
                console.log("Same as previous rendering, will not re-render");
                return;
            } else {
                this.previousRender["slicerSettings.multiSelect"] = this.formattingSettings.slicerSettings.multiSelect.value
                this.previousRender["viewport.height"] = Math.round(options.viewport.height * 10000) / 10000
                this.previousRender["table.rows.length"] = rows.length
                this.previousRender["table.rows.0.0"] = rows[0][0].toString()
                this.previousRender["table.rows.0.max"] = rows[0][rows[0].length - 1].toString()
                this.previousRender["table.rows.max.0"] = rows[rows.length - 1][0].toString()
                this.previousRender["table.rows.0.max"] = rows[0][rows[0].length - 1].toString()
            }
        }

        const jsonFilters: any = options.jsonFilters;

        this.viewport = options.viewport;
        const { height } = this.viewport;
        const selectedItems = []
        if (jsonFilters && jsonFilters[0] && options.dataViews) {
            console.log("FILTER from options.jsonFilters:", jsonFilters[0].target)
            const queryName = `${jsonFilters[0].target.table}.${jsonFilters[0].target.column}`
            for (const col of options.dataViews[0].metadata.columns) {
                if (queryName == col.queryName) {
                    for (const value of jsonFilters[0].values) {
                        selectedItems.push(value)
                    }
                }
            }
        }

        if (options.dataViews && options.dataViews[0]) {
            const slicerSettings = this.formattingSettings.slicerSettings
            const table = options.dataViews[0].table
            this.reactRoot = createRoot(this.target, {});
            this.reactElement = React.createElement(ReactPBIHierarchySlicer, { height, table, selectedItems, slicerSettings, handleFilter: this.handleFilter })
            this.reactRoot.render(this.reactElement)
        } else {
            console.log("Nothing in options.dataViews")
        }
    }
}