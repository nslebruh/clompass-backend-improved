const express = require("express");
const cors = require('cors');
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
app.get("/api", async (req, res) => {
    res.status(200).send("api")
})

app.get("/clompass", async (req, res) => {
    console.log("request found")
    if (!req.query.username || !req.query.password) {
        res.status(400).send("This ain't it chief")
        return
    }
    const response = [];
    const username = req.query.username;
    const password = req.query.password;
    let id = 0;
    console.log("starting puppeteer")
    const browser = await puppeteer.launch({headless: false, slowMo: 250, "args" : ["--no-sandbox", "--disable-setuid-sandbox"]})
    console.log("opening new page")
    let page = await browser.newPage()
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
            req.abort();
        } else if (req.url().includes("https://lilydaleheights-vic.compass.education/Services/Calendar.svc/GetCalendarEventsByUser?sessionstate=readonly&includeEvents=true&includeAllPd=true&includeExams=true&includeVolunteeringEvent=true")) {
            let body = req.postData()
            body = JSON.parse(body)
            console.log(body)
            body.limit = 500;
            body.startDate = "2022/1/2"
            body.endDate = "2022/3/1"
            body = JSON.stringify(body)
            req.continue({postData: body});
        } else {
            req.continue();
        }
    });
    page.on("requestfinished", async (request) => {
        if (request.url().includes("https://lilydaleheights-vic.compass.education/Services/Calendar.svc/GetCalendarEventsByUser?sessionstate=readonly&includeEvents=true&includeAllPd=true&includeExams=true&includeVolunteeringEvent=true")) {
            console.log(request.postData())
            let responsebody = await request.response().json()
            for (i=0; i<responsebody.length; i++) {
                let body = responsebody[i]
                if (responsebody[i].managerId !== null) {
                    let start = responsebody[i].start;
                    let finish = responsebody[i].end;
                    let title = responsebody[i].longTitleWithoutTime;
                    response.push({start: start, end: finish, title: title})
                }
                
            }
        }
    })
    console.log("navigating to compass site")
    await page.goto("https://lilydaleheights-vic.compass.education");
    await page.waitForSelector("#username");

    await page.$eval("#username", (el, username) => {
        el.value = username
    }, username)
    await page.$eval("#password", (el, password) => {
        el.value = password
    }, password)
    await page.$eval("#button1", el => {
        el.disabled = false;
        el.click()
    })
    await page.waitForSelector("#c_bar")
    await page.goto("https://lilydaleheights-vic.compass.education/Organise/Calendar/")
    await page.waitForResponse((response) => {
        return response.url().includes("https://lilydaleheights-vic.compass.education/Services/Calendar.svc/GetCalendarEventsByUser?sessionstate=readonly&includeEvents=true&includeAllPd=true&includeExams=true&includeVolunteeringEvent=true")
    })
    await sleep(500)
    await browser.close()
    res.status(200).send({message: "pog it worker", response: response})
    return
})
app.get('*', (req, res) => {
    console.log("request found")
    res.status(400).send("nah chief this ain't it")
  });
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});