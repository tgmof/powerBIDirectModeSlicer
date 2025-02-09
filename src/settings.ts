"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Data Point Formatting Card
 */
class SlicerSettings extends FormattingSettingsCard {
    multiSelect = new formattingSettings.ToggleSwitch({
        name: "multiSelect",
        displayName: "Multi-Select",
        description: "Enable multi-selection",
        value: false
    });


    name: string = "slicerSettings";
    displayName: string = "Slicer Settings";
    slices: Array<FormattingSettingsSlice> = [this.multiSelect];
}

/**
* visual settings model class
*
*/
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    slicerSettings = new SlicerSettings();

    cards = [this.slicerSettings];
}
