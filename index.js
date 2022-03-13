const express = require("express");
const cors = require('cors');
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const res = require("express/lib/response");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
app.get("/api", async (req, res) => {
    res.status(200).send("api")
})

app.get("/get/learningtasks", async (req, res) => {
    console.log("request received")
    if (!req.query.username || !req.query.password) {
        res.status(400).send("This ain't it chief")
        return
    }
    const response = [];
    let doneYet = false;
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
                            attachments.push({name: task.attachments[j].name, link: "https://lilydaleheights-vic.compass.education/Services/FileAssets.svc/DownloadFile?id=" + task.attachments[j].id + "&originalFileName=" + task.attachments[j].fileName.replace(/ /g, "%20"),});
                        }
                      } else {
                        attachments = "None";
                      }
                    
                    if (task.students[0].submissions != null) {
                      for (let j = 0; j < task.students[0].submissions.length; j++) {
                            submissions.push({name: task.students[0].submissions[j].fileName, link: "https://lilydaleheights-vic.compass.education/Services/FileDownload/FileRequestHandler?FileDownloadType=2&taskId=" + task.students[0].taskId + "&submissionId=" + task.students[0].submissions[j].id});
                      }
                    } else {
                      submissions = "None"
                    }
                    response.push({name: name, subject_name: subject_name, subject_code: subject_code, attachments: attachments, description: description, official_due_date: official_due_date, individual_due_date: individual_due_date, submission_status: submission_status, submissions: submissions, submission_svg_link: submission_svg_link, id: id});
                    id++; 
                }
              doneYet = true;
            }
        })
    console.log("navigating to compass site")
    await page.goto("https://lilydaleheights-vic.compass.education");
    await page.waitForSelector("#username");
    console.log("inputting username")
    await page.$eval("#username", (el, username) => {
        el.value = username
    }, username)
    console.log("inputting password")
    await page.$eval("#password", (el, password) => {
        el.value = password
    }, password)
    console.log("clicking login button")
    await page.$eval("#button1", el => {
        el.disabled = false;
        el.click()
    })
    console.log("waiting for compass homepage to load")
    await page.waitForSelector("#c_bar")
    console.log("navigating to learning tasks page")
    await page.goto("https://lilydaleheights-vic.compass.education/Records/User.aspx#learningTasks")
    console.log("waiting for response")
    await page.waitForResponse((response) => {
        return response.url().includes("https://lilydaleheights-vic.compass.education/Services/LearningTasks.svc/GetAllLearningTasksByUserId") && response.status() === 200
    })
    console.log("waiting for response to be processed")
    while (doneYet !== true) {
      await sleep(100)
    }
    console.log("closing browser")
    await browser.close();
    console.log("sending response")
    res.status(200).send({message: "pog it worker", response_type: "learning_tasks", response_data: response})
    return
}) 

app.get("/get/calender", async (req, res) => {
  console.log("request received")
  if (!req.query.username || !req.query.password) {
      res.status(400).send("This ain't it chief")
      return
  }
  const username = req.query.username;
  const password = req.query.password;
  console.log("starting puppeteer")
  const browser = await puppeteer.launch({headless: true, "args" : ["--no-sandbox", "--disable-setuid-sandbox"]})
  console.log("opening new page")
  let page = await browser.newPage();
  page.on("request", request => {
    if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
      request.abort();
    }
    else {
      request.continue()
    }
  })
  page.on('console', async (msg) => {
    const msgArgs = msg.args();
    for (let i = 0; i < msgArgs.length; ++i) {
      console.log(await msgArgs[i].jsonValue());
    }
  });
  console.log("navigating to compass site")
  await page.goto("https://lilydaleheights-vic.compass.education");
  await page.waitForSelector("#username");
  console.log("inputting username")
  await page.$eval("#username", (el, username) => {
      el.value = username
  }, username)
  console.log("inputting password")
  await page.$eval("#password", (el, password) => {
      el.value = password
  }, password)
  console.log("clicking login button")
  await page.$eval("#button1", el => {
      el.disabled = false;
      el.click()
  })
  console.log("waiting for compass homepage to load")
  await page.waitForSelector("#c_bar")
  await page.goto("https://lilydaleheights-vic.compass.education/Communicate/ManageCalendars.aspx")
  await page.waitForSelector("#ctl00_cpS_lnkResetCalendarKey");
  if (await page.$("#ctl00_cpS_lnkEnableSharedCalendar") !== null) {
    await page.click("#ctl00_cpS_lnkEnableSharedCalendar")
    await page.waitForSelector("#ctl00_cpM_lblPrivate")
  }
  const response = await page.evaluate(async () => {
    let el = document.querySelector("#ctl00_cpM_lblPrivate")
    let response = ""
    response = el.innerText
    return response
  })
  console.log("closing browser")
  await browser.close();
  console.log("sending response")
  res.status(200).send({message: "pog it worker", response_type: "schedule_url", response_data: response})
  return
})

app.get("/get/studentinfo", async (req, res) => {
  console.log("request received")
  if (!req.query.username || !req.query.password) {
      res.status(400).send("This ain't it chief")
      return
  }
  let response = {};
  let id = 0;
  let doneYet1 = false
  let doneYet2 = false
  const username = req.query.username;
  const password = req.query.password;
  console.log("starting puppeteer")
  const browser = await puppeteer.launch({headless: true, "args" : ["--no-sandbox", "--disable-setuid-sandbox"]})
  console.log("opening new page")
  let page = await browser.newPage();
  page.on('console', async (msg) => {
    const msgArgs = msg.args();
    for (let i = 0; i < msgArgs.length; ++i) {
      console.log(await msgArgs[i].jsonValue());
    }
  });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
      req.abort();
    } else if (req.url().includes("https://lilydaleheights-vic.compass.education/Services/ChronicleV2.svc/GetUserChronicleFeed")) {
      let postData = req.postData()
      postData = JSON.parse(postData)
      postData.startDate = "1969-12-31T23:00:00.000Z"
      postData.pageSize =  100;
      postData = JSON.stringify(postData)
      req.continue({postData: postData})
    } else {
      req.continue()
    }
      
  });
  page.on("requestfinished", async (request) => {
      if (request.url().includes("https://lilydaleheights-vic.compass.education/Services/User.svc/GetUserDetailsBlobByUserId")) {
          let responsebody = await request.response().json();
          responsebody = responsebody.d;
          response.name = responsebody.userFullName
          response.house = responsebody.userHouse
          response.form = responsebody.userFormGroup
          response.prefered_name = responsebody.userPreferredName
          response.school_id = responsebody.userSussiID
          response.image = "https://lilydaleheights-vic.compass.education/" + responsebody.userPhotoPath
          doneYet1 = true
      } else if (request.url().includes("https://lilydaleheights-vic.compass.education/Services/ChronicleV2.svc/GetUserChronicleFeed")) {
        let responsebody = await request.response().json();
        console.log("found response")
        responsebody = responsebody.d.data;
        let list = []
        for (i=0;i<responsebody.length;i++) {
          let data = responsebody[i].chronicleEntries[0];
          let createdTimestamp = data.createdTimestamp;
          let occurredTimestamp = data.occurredTimestamp;
          let name = data.templateName
          let chronicles = [];
          for (j=0; j<data.inputFields.length; j++) {
            let field_name = data.inputFields[j].name
            let description = data.inputFields[j].description
            let value = []
            let values;
            if (data.inputFields[j].value.includes("[{")) {
              values = JSON.parse(data.inputFields[j].value)
            } else {
              values = data.inputFields[j].value
            }
            
            if (values instanceof Array) {
              for (k=0; k<values.length; k++) {
                let o = {}
                o.type = "option"
                o.name = values[k].valueOption
                o.checked = values[k].isChecked
                value.push(o)
              }
            } else {
              let o = {}
              o.type = "text"
              o.text = values
              value.push(o)
            }
            
            chronicles.push({name: field_name, description: description, value: value})
          }
          list.push({id: id, createdTimestamp: createdTimestamp, occurredTimestamp: occurredTimestamp, name: name, data: chronicles})
          id++
        }
        
        response.chronicles = list
        doneYet2 = true
    }
        
  })
  console.log("navigating to compass site")
  await page.goto("https://lilydaleheights-vic.compass.education");
  await page.waitForSelector("#username");
  console.log("inputting username")
  await page.$eval("#username", (el, username) => {
      el.value = username
  }, username)
  console.log("inputting password")
  await page.$eval("#password", (el, password) => {
      el.value = password
  }, password)
  console.log("clicking login button")
  await page.$eval("#button1", el => {
      el.disabled = false;
      el.click()
  })
  console.log("waiting for compass homepage to load")
  await page.waitForSelector("#c_bar")
  console.log("navigating to student info page")
  await page.goto("https://lilydaleheights-vic.compass.education/Records/User.aspx")
  console.log("waiting for response")
  await page.waitForResponse((res) => {
    return res.url().includes("https://lilydaleheights-vic.compass.education/Services/User.svc/GetUserDetailsBlobByUserId") && res.status() === 200
  })
  console.log("found response")
  console.log("waiting for info to be processed")
  while (doneYet1 !== true || doneYet2 !== true) {
    await sleep(100)
  }
  console.log("closing browser")
  await browser.close()
  console.log("sending response")
  res.status(200).send({message: "pog it worker", response_type: "student_info", response_data: response})
})
app.get('*', (req, res) => {
    res.status(400).send("nah chief this ain't it")
    return
  });
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});