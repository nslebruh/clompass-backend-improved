const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors)

const PORT = process.env.PORT || 3001;

app.get("/clompass", async (req, res) => {
    console.log("request found")
    if (!req.query.username || !req.query.password) {
        res.status(400).send("This ain't it chief")
        return
    }
    const username = req.query.username;
    const password = req.query.password;
    console.log("starting puppeteer")
    const browser = await puppeteer.launch({headless: true, "args" : ["--no-sandbox", "--disable-setuid-sandbox"]})
    console.log("opening new page")
    let page = await browser.newPage()
    console.log("navigating to compass site")
    await page.goto("https://lilydaleheights-vic.compass.education");
    await page.waitForSelector("#username");

    await page.$eval("#username", (el, username) => {
        el.value = username
    })
    await page.$eval("#password", (el, password) => {
        el.value = password
    })
    await page.$eval("#button1", el => {
        el.disabled = false;
        el.click()
    })
    await page.waitForSelector("#c_bar")
    res.status(200).send("pog it worked")
    return
}) 
app.get('*', (req, res) => {
    res.status(400).send("nah chief this ain't it")
  });
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});