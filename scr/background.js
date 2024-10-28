/*
 * Definitions of some concepts
 *
 * System colour scheme:
 * The colour scheme of the operating system, usually light or dark.
 *
 * Browser colour scheme / current.scheme:
 * The "website appearance" settings of Firefox, which can be light, dark, or auto.
 * It decides whether the light theme or dark theme is preferred.
 *
 * pref.allowDarkLight:
 * A setting that decides if a light theme is allowed to be used when current.scheme is dark, or vice versa.
 *
 * theme-color / meta theme colour:
 * A colour defined with a meta tag by some websites, usually static.
 * It is often more related to the branding than the appearance of the website.
 *
 * Theme:
 * An object that defines the appearance of the Firefox chrome.
 */

import {
	default_homeBackground_light,
	default_homeBackground_dark,
	default_fallbackColour_light,
	default_fallbackColour_dark,
	default_customRule_webPage,
	default_customRule_aboutPage,
} from "./default_values.js";

import { legacyPrefKey, verifyPref } from "./pref.js";

import { rgba, dimColour, contrastRatio } from "./colour.js";

// Settings cache: always synced with settings
var pref = {
	allowDarkLight: true,
	dynamic: true,
	noThemeColour: true,
	tabbar: 0,
	tabbarBorder: 0,
	tabSelected: 0.1,
	tabSelectedBorder: 0.0,
	toolbar: 0,
	toolbarBorder: 0,
	toolbarField: 0.05,
	toolbarFieldBorder: 0.1,
	toolbarFieldOnFocus: 0.05,
	sidebar: 0.05,
	sidebarBorder: 0.05,
	popup: 0.05,
	popupBorder: 0.05,
	minContrast_light: 4.5,
	minContrast_dark: 4.5,
	custom: false,
	homeBackground_light: default_homeBackground_light,
	homeBackground_dark: default_homeBackground_dark,
	fallbackColour_light: default_fallbackColour_light,
	fallbackColour_dark: default_fallbackColour_dark,
	customRule_webPage: default_customRule_webPage,
	version: [2, 2],
};

// Variables
var current = {
	scheme: "light", // "light", "dark", or "auto"
	homeBackground_light: rgba(default_homeBackground_light),
	homeBackground_dark: rgba(default_homeBackground_dark),
	fallbackColour_light: rgba(default_fallbackColour_light),
	fallbackColour_dark: rgba(default_fallbackColour_dark),
	customRule: {},
};

// Colour codes
var colourCode = {
	light: {
		HOME: current.homeBackground_light,
		FALLBACK: current.fallbackColour_light,
		IMAGEVIEWER: current.fallbackColour_light,
		PLAINTEXT: rgba([236, 236, 236, 1]),
		SYSTEM: rgba([255, 255, 255, 1]),
		ADDON: rgba([236, 236, 236, 1]),
		PDFVIEWER: rgba([249, 249, 250, 1]),
		DEFAULT: rgba([255, 255, 255, 1]),
	},
	dark: {
		HOME: current.homeBackground_dark,
		FALLBACK: current.fallbackColour_dark,
		IMAGEVIEWER: current.fallbackColour_dark,
		PLAINTEXT: rgba([50, 50, 50, 1]),
		SYSTEM: rgba([30, 30, 30, 1]),
		ADDON: rgba([50, 50, 50, 1]),
		PDFVIEWER: rgba([56, 56, 61, 1]),
		DEFAULT: rgba([28, 27, 34, 1]),
	},
};

/**
 * Sets "current" values after pref being loaded.
 */
function updateCurrent() {
	if (pref.custom) {
		current.homeBackground_light = rgba(pref.homeBackground_light);
		current.homeBackground_dark = rgba(pref.homeBackground_dark);
		current.fallbackColour_light = rgba(pref.fallbackColour_light);
		current.fallbackColour_dark = rgba(pref.fallbackColour_dark);
		current.customRule = pref.customRule_webPage;
	} else {
		current.homeBackground_light = rgba(default_homeBackground_light);
		current.homeBackground_dark = rgba(default_homeBackground_dark);
		current.fallbackColour_light = rgba(default_fallbackColour_light);
		current.fallbackColour_dark = rgba(default_fallbackColour_dark);
		current.customRule = {};
	}
	getBrowserColourScheme((scheme) => {
		current.scheme = scheme;
	});
}

/**
 * Overrides content colour scheme.
 * @return
 */
async function getBrowserColourScheme() {
	const result = await browser.browserSettings.overrideContentColorScheme.get({});
	return result.value;
}

browser.browserSettings.overrideContentColorScheme.onChange.addListener(updateCurrent);

initialise();

/**
 * Initialises the pref and current.
 */
async function initialise() {
	const storedPref = await browser.storage.local.get();
	// If the storage is empty / no version number is recorded, treats it as a fresh installation
	const freshInstall =
		Object.keys(storedPref).length == 0 || !("last_version" in storedPref) || !("version" in storedPref);
	if (!freshInstall) {
		for (let key in storedPref) {
			if (key in pref) pref[key] = storedPref[key];
			else if (key in legacyPrefKey) pref[legacyPrefKey[key]] = storedPref[key];
		}
		// Updating from before v2.2
		if (pref.version < [2, 2]) {
			pref.dynamic = true;
			pref.allowDarkLight = true;
			pref.noThemeColour = true;
			if (pref.scheme == "system") pref.scheme = "auto";
		}
		// Updating from before v1.7.5
		// Converts legacy rules to query selector format
		if (pref.version < [1, 7, 5]) {
			for (let domain in pref.customRule_webPage) {
				let legacyRule = pref.customRule_webPage[domain];
				if (legacyRule.startsWith("TAG_")) {
					pref.customRule_webPage[domain] = legacyRule.replace("TAG_", "QS_");
				} else if (legacyRule.startsWith("CLASS_")) {
					pref.customRule_webPage[domain] = legacyRule.replace("CLASS_", "QS_.");
				} else if (legacyRule.startsWith("ID_")) {
					pref.customRule_webPage[domain] = legacyRule.replace("ID_", "QS_#");
				} else if (legacyRule.startsWith("NAME_")) {
					pref.customRule_webPage[domain] = `${legacyRule.replace("NAME_", "QS_[name='")}']`;
				} else if (legacyRule == "") {
					delete pref.customRule_webPage[domain];
				}
			}
		}
		// Updating from before v1.7.4
		// Clears possible empty reserved colour rules caused by a bug
		if (pref.version < [1, 7, 4]) delete pref.customRule_webPage[undefined];
		// Updating from before v1.6.4
		// Corrects the dark home page colour, unless the user has set something different
		if (pref.version < [1, 6, 5] && pref.homeBackground_dark.toUpperCase() == "#1C1B22")
			pref.homeBackground_dark = default_homeBackground_dark;
	}
	updateCurrent();
	update();
	await browser.storage.local.set(pref);
	return true;
}

browser.tabs.onUpdated.addListener(update);
browser.tabs.onActivated.addListener(update);
browser.tabs.onAttached.addListener(update);
browser.windows.onFocusChanged.addListener(update);

browser.runtime.onMessage.addListener((message, sender) => {
	switch (message.reason) {
		// When pref is detected corrupted
		case "INIT_REQUEST":
			initialise();
			break;
		// When pref changes
		case "UPDATE_REQUEST":
			loadPrefAndUpdate();
			break;
		// Content script sends a colour
		case "COLOUR_UPDATE":
			sender.tab.active ? setFrameColour(sender.tab.windowId, message.colour) : update();
			break;
	}
});

// Light mode match media, which is supposed to detect the system level colour scheme
const lightModeDetection = window.matchMedia("(prefers-color-scheme: light)");
if (lightModeDetection)
	lightModeDetection.onchange = () => {
		if (pref.scheme == "auto") loadPrefAndUpdate();
	};

// Dark mode match media, which is supposed to detect the system level colour scheme
const darkModeDetection = window.matchMedia("(prefers-color-scheme: dark)");
if (darkModeDetection)
	darkModeDetection.onchange = () => {
		if (pref.scheme == "auto") loadPrefAndUpdate();
	};

/**
 * @returns "light" or "dark" depending on the system's setting.
 * @returns "light" if it cannot be detected.
 */
function systemColourScheme() {
	return lightModeDetection?.matches ? "light" : "dark";
}

/**
 * Triggers colour change in all windows.
 */
async function update() {
	const tabs = await browser.tabs.query({ active: true, status: "complete" });
	if (!verifyPref(pref)) await initialise();
	tabs.forEach(updateEachWindow);
}

/**
 * Updates pref cache and triggers colour change in all windows.
 */
function loadPrefAndUpdate() {
	browser.storage.local.get((storedPref) => {
		pref = storedPref;
		getBrowserColourScheme(pref.scheme);
		updateCurrent();
		update();
	});
}

// WIP: Change to reverved colour manager
/**
 * Converts an URL to a search key for customRule.
 * @param {string} url an URL e.g. "about:page/etwas", "etwas://addons.mozilla.org/etwas", "moz-extension://*UUID/etwas".
 * @returns e.g. for about pages: "about:page", for websites: "addons.mozilla.org", for add-on pages "Add-on ID: ATBC@EasonWong".
 */
function getSearchKey(url) {
	if (url.startsWith("about:")) return Promise.resolve(url.split(/\/|\?/)[0]); // e.g. "about:page"
	else if (url.startsWith("moz-extension:")) {
		// Searches for add-on ID
		// Colours for add-on pages are stored with the add-on ID as their keys
		let uuid = url.split(/\/|\?/)[2];
		return new Promise((resolve) => {
			browser.management.getAll().then((addonList) => {
				let foundAddonID = false;
				for (let addon of addonList) {
					if (addon.type != "extension" || !addon.hostPermissions) continue;
					for (let host of addon.hostPermissions) {
						if (!host.startsWith("moz-extension:") || uuid != host.split(/\/|\?/)[2]) continue;
						resolve(`Add-on ID: ${addon.id}`);
						foundAddonID = true;
						break;
					}
					if (foundAddonID) break;
				}
			});
		});
	}
	// In case of a regular website, returns its domain, e.g. "addons.mozilla.org"
	else return Promise.resolve(url.split(/\/|\?/)[2]);
}

/**
 * Updates the colour for a window.
 * @param {tabs.Tab} tab The tab the window is showing.
 */
function updateEachWindow(tab) {
	let url = tab.url;
	let windowId = tab.windowId;
	// Visiting browser's internal files (content script blocked)
	if (url.startsWith("view-source:")) setFrameColour(windowId, "PLAINTEXT");
	// Visiting browser's internal files (content script blocked)
	else if (url.startsWith("chrome:") || url.startsWith("resource:") || url.startsWith("jar:file:")) {
		if (url.endsWith(".txt") || url.endsWith(".css") || url.endsWith(".jsm") || url.endsWith(".js"))
			setFrameColour(windowId, "PLAINTEXT");
		else if (url.endsWith(".png") || url.endsWith(".jpg")) setFrameColour(windowId, "IMAGEVIEWER");
		else setFrameColour(windowId, "SYSTEM");
	} else {
		// Visiting normal websites, PDF viewer (content script blocked), websites that failed to load, or local files
		// WIP: add support for setting colours for about:pages
		// WIP: add support for regex / wildcard characters
		getSearchKey(url).then((key) => {
			let reversedCurrentScheme = current.scheme == "light" ? "dark" : "light";
			// For preferred scheme there's a reserved colour
			if (default_customRule_aboutPage[current.scheme][key])
				setFrameColour(windowId, rgba(default_customRule_aboutPage[current.scheme][key]));
			// Site has reserved colour only in the other mode, and it's allowed to change mode
			else if (default_customRule_aboutPage[reversedCurrentScheme][key] && pref.allowDarkLight)
				setFrameColour(windowId, rgba(default_customRule_aboutPage[reversedCurrentScheme][key]));
			// If changing mode is not allowed
			else if (url.startsWith("about:")) setFrameColour(windowId, "DEFAULT");
			else if (key.startsWith("Add-on ID: ") && current.customRule[key])
				setFrameColour(windowId, rgba(current.customRule[key]));
			else if (url.startsWith("moz-extension:")) setFrameColour(windowId, "ADDON");
			else setFrameColourWithTabResponse(getTabResponse(tab));
		});
	}
}

/**
 * Configures the content script and sets up theme with the colour from content script.
 * @param {tabs.Tab} tab the tab to contact.
 * @returns response of the tab.
 */
function getTabResponse(tab) {
	let url = tab.url;
	browser.tabs.sendMessage(
		tab.id,
		{
			reason: "COLOUR_REQUEST",
			conf: {
				dynamic: pref.dynamic,
				noThemeColour: pref.noThemeColour,
				customRule: getCustomRule(url),
			},
		},
		(response) => {
			return response;
		}
	);
}

function setFrameColourWithTabResponse(tab, response) {
	let windowId = tab.windowId;
	// The colour is successfully returned
	if (response) setFrameColour(windowId, response.colour);
	// Viewing an image on data:image (content script is blocked on data:pages)
	else if (url.startsWith("data:image")) setFrameColour(windowId, "IMAGEVIEWER");
	// When viewing a PDF file, Firefox blocks content script
	else if (url.endsWith(".pdf") || tab.title.endsWith(".pdf")) setFrameColour(windowId, "PDFVIEWER");
	// The page probably failed to load (content script is also blocked on website that failed to load)
	else if (tab.favIconUrl?.startsWith("chrome:")) setFrameColour(windowId, "DEFAULT");
	// When viewing plain text online, Firefox blocks content script
	// In this case, the tab title is the same as the URL
	else if (url.match(new RegExp(`https?:\/\/${tab.title}$`))) setFrameColour(windowId, "PLAINTEXT");
	// Uses fallback colour
	else setFrameColour(windowId, "FALLBACK");
}

function getCustomRule(url) {
	return null;
}

function getSuitableColourScheme(colour) {
	let eligibility_dark = contrastRatio(colour, rgba([255, 255, 255, 1])) > pref.minContrast_dark;
	let eligibility_light = contrastRatio(colour, rgba([0, 0, 0, 1])) > pref.minContrast_light;
	if (current.scheme == "light") {
		if (eligibility_light) return "light";
		if (pref.allowDarkLight && eligibility_dark) return "dark";
	} else {
		if (eligibility_dark) return "dark";
		if (pref.allowDarkLight && eligibility_light) return "light";
	}
	return false;
}

/**
 * Changes tab bar to the appointed colour. If the colour is not eligible, uses fallback colour.
 * @param {number} windowId The ID of the window.
 * @param {object | string} colour The colour to change to (in rgb object) or a colour code. Colour codes are: "HOME", "FALLBACK", "IMAGEVIEWER", "PLAINTEXT", "SYSTEM", "ADDON", "PDFVIEWER", and "DEFAULT".
 */
function setFrameColour(windowId, colour) {
	if (typeof colour == "string") applyTheme(windowId, colourCode[current.scheme][colour], current.scheme);
	else {
		let suitableColourScheme = getSuitableColourScheme(colour);
		if (suitableColourScheme) applyTheme(windowId, colour, suitableColourScheme);
		else setFrameColour(windowId, "FALLBACK");
	}
}

/**
 * Constructs and applies a theme to a given window.
 * @param {number} windowId The ID of the window.
 * @param {object} colour Colour of the frame, in rgba object.
 * @param {string} colourScheme "light" or "dark".
 */
function applyTheme(windowId, colour, colourScheme) {
	if (colourScheme == "light") {
		let theme = {
			colors: {
				// Tabbar & tab
				frame: dimColour(colour, -pref.tabbar * 1.5),
				frame_inactive: dimColour(colour, -pref.tabbar * 1.5),
				tab_selected: dimColour(colour, -pref.tabSelected * 1.5),
				ntp_background: dimColour(colour, 0),
				// Toolbar
				toolbar: dimColour(colour, -pref.toolbar * 1.5),
				toolbar_top_separator: "rgba(0, 0, 0, 0)",
				toolbar_bottom_separator: dimColour(colour, (-pref.toolbarBorder - pref.toolbar) * 1.5),
				// URL bar
				toolbar_field: dimColour(colour, -pref.toolbarField * 1.5),
				toolbar_field_border: "rgba(0, 0, 0, 0)",
				toolbar_field_focus: dimColour(colour, -pref.toolbarFieldOnFocus * 1.5),
				toolbar_field_border_focus: "rgb(130, 180, 245)",
				// Sidebar & popup
				sidebar: dimColour(colour, -pref.sidebar * 1.5),
				sidebar_border: dimColour(colour, (-pref.sidebar - pref.sidebarBorder) * 1.5),
				popup: dimColour(colour, -pref.popup * 1.5),
				popup_border: dimColour(colour, (-pref.popup - pref.popupBorder) * 1.5),
				// Static
				tab_background_text: "rgb(30, 30, 30)",
				tab_loading: "rgba(0, 0, 0, 0)",
				tab_line: "rgba(0, 0, 0, 0)",
				ntp_text: "rgb(0, 0, 0)",
				toolbar_text: "rgb(0, 0, 0)",
				toolbar_field_text: "rgba(0, 0, 0)",
				popup_text: "rgb(0, 0, 0)",
				sidebar_text: "rgb(0, 0, 0)",
				button_background_hover: "rgba(0, 0, 0, 0.10)",
				button_background_active: "rgba(0, 0, 0, 0.15)",
				icons: "rgb(30, 30, 30)",
			},
			properties: {
				color_scheme: "light",
				content_color_scheme: "auto",
			},
		};
		browser.theme.update(windowId, theme);
	}
	if (colourScheme == "dark") {
		let theme = {
			colors: {
				// Tabbar & tab
				frame: dimColour(colour, pref.tabbar),
				frame_inactive: dimColour(colour, pref.tabbar),
				tab_selected: dimColour(colour, pref.tabSelected),
				ntp_background: dimColour(colour, 0),
				// Toolbar
				toolbar: dimColour(colour, pref.toolbar),
				toolbar_top_separator: "rgba(0, 0, 0, 0)",
				toolbar_bottom_separator: dimColour(colour, pref.toolbarBorder + pref.toolbar),
				// URL bar
				toolbar_field: dimColour(colour, pref.toolbarField),
				toolbar_field_border: dimColour(colour, pref.toolbarFieldBorder),
				toolbar_field_focus: dimColour(colour, pref.toolbarFieldOnFocus),
				toolbar_field_border_focus: "rgb(70, 118, 160)",
				// Sidebar
				sidebar: dimColour(colour, pref.sidebar),
				sidebar_border: dimColour(colour, pref.sidebar + pref.sidebarBorder),
				popup: dimColour(colour, pref.popup),
				popup_border: dimColour(colour, pref.popup + pref.popupBorder),
				// Static
				tab_background_text: "rgb(225, 225, 225)",
				tab_loading: "rgba(0, 0, 0, 0)",
				tab_line: "rgba(0, 0, 0, 0)",
				ntp_text: "rgb(255, 255, 255)",
				toolbar_text: "rgb(255, 255, 255)",
				toolbar_field_text: "rgb(255, 255, 255)",
				popup_text: "rgb(225, 225, 225)",
				sidebar_text: "rgb(225, 225, 225)",
				button_background_active: "rgba(255, 255, 255, 0.15)",
				button_background_hover: "rgba(255, 255, 255, 0.10)",
				icons: "rgb(225, 225, 225)",
			},
			properties: {
				color_scheme: "dark",
				content_color_scheme: "auto",
			},
		};
		browser.theme.update(windowId, theme);
	}
}