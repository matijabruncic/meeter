const activeTabs = {};
const tabHistory = [];
const verbose = false

chrome.action.setIcon({path:"images/default-38.png"})
chrome.tabs.onCreated.addListener((tab) => {
        if (verbose) {
            console.log("OnCreated event received: " + JSON.stringify(tab))
        }
        startGoogleMeet(tab);
    }
)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (verbose) {
            console.log("OnUpdated event received: " + JSON.stringify(tab))
        }
        if (movingAwayFromGoogleMeet(tab)) {
            console.log("Moving from Google Meet to some other page")
            stopGoogleMeet(tab.id)
        }
        startGoogleMeet(tab)
    }
)
chrome.tabs.onRemoved.addListener((tabId, _) => {
        if (verbose) {
            console.log("OnRemoved event received: " + tabId)
        }
        stopGoogleMeet(tabId);
    }
)

chrome.alarms.onAlarm.addListener((alarm) => {
        if (verbose) {
            console.log("OnAlarm event received: " + JSON.stringify(alarm))
        }
        if (alarm.name === "update-counter") {
            refreshTimeSpent()
        } else if (alarm.name === "validation-checker") {
            validate()
        }
    }
)
chrome.alarms.create("update-counter", {periodInMinutes: 0.1})
chrome.alarms.create("validation-checker", {periodInMinutes: 0.1})

function cleanupUrl(tab) {
    return tab.url.replace(/\?.*/, "");
}

function isOnGoogleMeet(tab) {
    return /https:\/\/meet.google.com\/.*/i.test(tab.url);
}

function startGoogleMeet(tab) {
    if (!isOnGoogleMeet(tab)) {
        return
    }
    if (verbose){
        console.log("Opening Google Meet")
    }
    let status = activeTabs[tab.id]
    if (status == null) {
        status = {}
    }
    status["url"] = cleanupUrl(tab)
    if (!("created" in status)) {
        status["created"] = new Date()
    }
    activeTabs[tab.id] = status
    validate()
}

function movingAwayFromGoogleMeet(tab) {
    if (isOnGoogleMeet(tab)) {
        return false;
    }
    if (activeTabs[tab.id] === undefined) {
        return false;
    }
    if (!isOnGoogleMeet(activeTabs[tab.id])) {
        return false;
    }
    return true;
}

function refreshTimeSpent() {
    let totalTimeInMs = 0
    for (const tabHistoryElement of tabHistory) {
        let diff = tabHistoryElement.removed - tabHistoryElement.created
        totalTimeInMs += diff
    }
    for (const property in activeTabs) {
        let status = activeTabs[property]
        let diff = new Date() - status.created
        totalTimeInMs += diff
        if (verbose){
            console.log("Diff for active tab is: " + diff + " ms")
        }
    }

    if (verbose){
        console.log("Active tabs: " + JSON.stringify(activeTabs, null, 4))
        console.log("Tab history: " + JSON.stringify(tabHistory, null, 4))
        console.log("Total time in ms: " + totalTimeInMs)
    }
    let hours = Math.round(totalTimeInMs / 3600000)
    let minutes = Math.round((totalTimeInMs - (hours * 3600000)) / 60000)

    if (hours < 2) {
        chrome.action.setBadgeBackgroundColor(
            {color: "green"}
        );
    } else if (hours < 4) {
        chrome.action.setBadgeBackgroundColor(
            {color: 'orange'}
        )
    } else {
        chrome.action.setBadgeBackgroundColor(
            {color: 'red'}
        )
    }

    let text = String(hours) + "h" + String(minutes) + "m";
    if (verbose) {
        console.log(text)
    }
    chrome.action.setBadgeText({text: text});
}

function validate() {
    chrome.tabs.query({}, function (tabs) {
        let googleMeetCounter = 0
        for (const tab of tabs) {
            if (isOnGoogleMeet(tab)) {
                googleMeetCounter++
            }
        }
        if (verbose){
            console.log(googleMeetCounter + "/" + tabs.length + " tabs are using Google Meet")
        }
        if (googleMeetCounter>1){
            chrome.action.setIcon({path:"images/error-38.png"})
        } else {
            chrome.action.setIcon({path:"images/up-38.png"})
        }
    });
}

function stopGoogleMeet(tabId) {
    let status = activeTabs[tabId]
    if (status === undefined) {
        return
    }
    if (!("removed" in status)) {
        status["removed"] = new Date()
    }
    tabHistory.push(status)
    delete activeTabs[tabId]
    refreshTimeSpent()
    validate()
}
