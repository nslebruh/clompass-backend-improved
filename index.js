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
    const browser = await puppeteer.launch({headless: true, "args" : ["--no-sandbox", "--disable-setuid-sandbox"]})
    console.log("opening new page")
    let page = await browser.newPage()
    await page.setRequestInterception(true);
        page.on('request', (req) => {
            if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
                req.abort();
            } else if (req.url().includes("https://lilydaleheights-vic.compass.education/Services/LearningTasks.svc/GetAllLearningTasksByUserId")) {
                let body = req.postData()
                body = JSON.parse(body)
                body.limit = 500;
                delete body.forceTaskId
                body = JSON.stringify(body)
                req.continue({postData: body});
            } else {
                req.continue();
            }
        });
        page.on("requestfinished", async (request) => {
            if (request.url().includes("https://lilydaleheights-vic.compass.education/Services/LearningTasks.svc/GetAllLearningTasksByUserId")) {
                let responsebody = await request.response().json();
                responsebody = responsebody.d.data;
                for (let i = 0; i < responsebody.length; i++) {
                    let task = responsebody[i];
                    let name = task.name;
                    let subject_name = task.subjectName;
                    let subject_code = task.activityName;
                    let attachments = [];
                    let submissions = [];
                    let description = task.description;
                    let official_due_date = task.dueDateTimestamp;
                    let individual_due_date = task.students[0].dueDateTimestamp;
                    individual_due_date ? individual_due_date = individual_due_date : individual_due_date = official_due_date;
                    let submission_status;
                    let submission_svg_link;
                    if (task.students[0].submissionStatus === 1) {
                        submission_status = "Pending";
                        submission_svg_link = "https://cdn.jsdelivr.net/gh/clompass/clompass@main/public/svg/task-status/pending.svg";
                      } else if (task.students[0].submissionStatus === 2) {
                        submission_status = "Overdue";
                        submission_svg_link = "https://cdn.jsdelivr.net/gh/clompass/clompass@main/public/svg/task-status/overdue.svg";
                      } else if (task.students[0].submissionStatus === 3) {
                        submission_status = "On time";
                        submission_svg_link = "https://cdn.jsdelivr.net/gh/clompass/clompass@main/public/svg/task-status/ontime.svg"
                      } else if (task.students[0].submissionStatus === 4) {
                        submission_status = "Recieved late";
                        submission_svg_link = "https://cdn.jsdelivr.net/gh/clompass/clompass@main/public/svg/task-status/receivedlate.svg";
                      } else {
                        submission_status = "Unknown"
                      }
                    if (task.attachments != null) {
                        for (let j = 0; j < task.attachments.length; j++) {
                            attachments.push({attachment_name: task.attachments[j].name, attachment_link: "https://lilydaleheights-vic.compass.education/Services/FileAssets.svc/DownloadFile?id=" + task.attachments[j].id + "&originalFileName=" + task.attachments[j].fileName.replace(/ /g, "%20"),});
                        }
                      } else {
                        attachments = "None";
                      }
                    
                    if (task.students[0].submissions != null) {
                      for (let j = 0; j < task.students[0].submissions.length; j++) {
                            submissions.push({submission_name: task.students[0].submissions[j].fileName, submission_link: "https://lilydaleheights-vic.compass.education/Services/FileDownload/FileRequestHandler?FileDownloadType=2&taskId=" + task.students[0].taskId + "&submissionId=" + task.students[0].submissions[j].id});
                      }
                    }
                    response.push({name: name, subject_name: subject_name, subject_code: subject_code, attachments: attachments, description: description, official_due_date: official_due_date, individual_due_date: individual_due_date, submission_status: submission_status, submissions: submissions, submission_svg_link: submission_svg_link, id: id});
                    id++; 
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
    await page.goto("https://lilydaleheights-vic.compass.education/Records/User.aspx#learningTasks")
    await page.waitForResponse((response) => {
        return response.url().includes("https://lilydaleheights-vic.compass.education/Services/LearningTasks.svc/GetAllLearningTasksByUserId") && response.status() === 200
    })
    await sleep(500);
    await browser.close();
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