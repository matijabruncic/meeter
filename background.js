const verbose = false

class Period {
    start
    end

    constructor() {
        this.start = new Date()
        this.end = new Date()
    }

    static fromJSON(old) {
        if (old == null) {
            return null
        }
        let newObject = new Period();
        newObject.start = old.start != null ? new Date(old.start) : null
        newObject.end = old.end != null ? new Date(old.end) : null
        return newObject
    }


    prolong() {
        this.end = new Date()
    }

    timeSpent() {
        return this.end - this.start
    }

}

class DayPeriods {

    periods = []
    existingPeriod

    static fromJSON(old) {
        if (old == null) {
            return null
        }
        let newObject = new DayPeriods();
        newObject.existingPeriod = Period.fromJSON(old.existingPeriod)
        for (const period of old.periods) {
            newObject.periods.push(Period.fromJSON(period))
        }
        return newObject
    }

    endPeriod() {
        this.existingPeriod.prolong()
        this.periods.push(this.existingPeriod)
        this.existingPeriod = null
    }

    prolong() {
        if (this.existingPeriod == null) {
            throw "Not possible to prolong the period when existing period == null"
        }
        this.existingPeriod.prolong()
    }

    startNewPeriod() {
        this.existingPeriod = new Period()
        return this.existingPeriod
    }

    getExistingPeriod() {
        if (this.existingPeriod == null) {
            return null
        }
        return this.existingPeriod;
    }

    getCumulative() {
        let result = 0
        for (const period of this.periods) {
            result += period.timeSpent()
        }
        if (this.existingPeriod != null) {
            result += this.existingPeriod.timeSpent()
        }
        return result
    }
}

chrome.action.setIcon({path: "images/default-38.png"})

chrome.tabs.onCreated.addListener((tab) => {
    validate()
})
chrome.tabs.onUpdated.addListener((tab) => {
    validate()
})
chrome.tabs.onRemoved.addListener((tabId, _) => {
    validate()
})

chrome.alarms.onAlarm.addListener((alarm) => {
        if (verbose) {
            console.log("OnAlarm event received: " + JSON.stringify(alarm))
        }
        if (alarm.name === "refresh-icon") {
            refreshIcon()
        } else if (alarm.name === "tracker") {
            tracker()
        } else {
            throw "Alarm is missing. Alarm name:" + alarm.name
        }
    }
)
chrome.alarms.create("refresh-icon", {periodInMinutes: 0.015})
chrome.alarms.create("tracker", {periodInMinutes: 0.015})

function isOnGoogleMeet(tab) {
    return /https:\/\/meet.google.com\/.*/i.test(tab.url);
}

function refreshIcon() {
    let totalTimeInMs = 0
    chrome.storage.local.get(getTodaysDate(), function (days) {
        let todaysPeriods = DayPeriods.fromJSON(JSON.parse(days[getTodaysDate()]));
        totalTimeInMs = days[getTodaysDate()] == null ? 0 : todaysPeriods.getCumulative();
        let hours = Math.floor(totalTimeInMs / 3600000)
        let minutes = Math.floor((totalTimeInMs - (hours * 3600000)) / 60000)
        let seconds = Math.floor((totalTimeInMs - (hours * 3600000) - (minutes * 60000)) / 1000)

        if (hours < 2) {
            chrome.action.setBadgeBackgroundColor({color: "green"});
        } else if (hours < 4) {
            chrome.action.setBadgeBackgroundColor({color: 'orange'});
        } else {
            chrome.action.setBadgeBackgroundColor({color: 'red'});
        }

        let text = hours < 1 ? String(minutes) + "m" + String(seconds) + "s" : String(hours) + "h" + String(minutes) + "m";
        if (verbose) {
            console.log(text)
        }
        chrome.action.setBadgeText({text: text});
    });
}

function getTodaysDate() {
    return new Date().toISOString().split('T')[0];
}

function tracker() {
    chrome.tabs.query({}, function (tabs) {
        let googleMeetCounter = 0
        for (const tab of tabs) {
            if (isOnGoogleMeet(tab)) {
                googleMeetCounter++
            }
        }
        let date = getTodaysDate();
        chrome.storage.local.get(date, function (days) {
            let todaysPeriods = days[date] != null ? DayPeriods.fromJSON(JSON.parse(days[date])) : new DayPeriods();
            let existingPeriod = todaysPeriods.getExistingPeriod()
            if (existingPeriod == null && googleMeetCounter > 0) { //beginning of new period
                todaysPeriods.startNewPeriod()
            } else if (existingPeriod != null && googleMeetCounter > 0) { //continuation of existing period
                existingPeriod.prolong()
            } else if (existingPeriod != null && googleMeetCounter === 0) { //end of a period
                todaysPeriods.endPeriod()
            } else if (existingPeriod == null && googleMeetCounter === 0) { //Google Meet is not opened
                //don't do anything
                if (verbose) {
                    console.log("Google Meet is not open")
                }
            } else {
                throw "Something is wrong - debug!"
            }
            chrome.storage.local.set({[date]: JSON.stringify(todaysPeriods)}, function () {
                if (verbose) {
                    chrome.storage.local.get(getTodaysDate(), function (days) {
                        console.log(`Saved ${date} to storage: ${JSON.stringify(days)}. Todays periods: ${JSON.stringify(todaysPeriods)}`)
                    })
                }
            });
        })
    })
}

function validate() {
    chrome.tabs.query({}, function (tabs) {
        let googleMeetCounter = 0
        for (const tab of tabs) {
            if (isOnGoogleMeet(tab)) {
                googleMeetCounter++
            }
        }
        if (verbose) {
            console.log(googleMeetCounter + "/" + tabs.length + " tabs are using Google Meet")
        }
        chrome.storage.local.get(getTodaysDate(), function (days) {
            if (googleMeetCounter > 1) {
                chrome.action.setIcon({path: "images/error-38.png"})
            } else if (googleMeetCounter === 0 || days[getTodaysDate()] == null || DayPeriods.fromJSON(JSON.parse(days[getTodaysDate()])).getExistingPeriod() == null) {
                chrome.action.setIcon({path: "images/gray-38.png"})
            } else {
                chrome.action.setIcon({path: "images/up-38.png"})
            }
        })
    });
}
