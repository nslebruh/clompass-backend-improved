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
    let requestNumber = 0
    let foundLogin = false
    let loginFailed = false
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
          if (request.url().includes("https://lilydaleheights-vic.compass.education/login.aspx")) {
            console.log("found login request")
            console.log(requestNumber)
            if (requestNumber !== 1) {
              requestNumber++
              return
            }
            if (request.response().status() >= 300 && request.response().status() <= 399) {
              console.log("is a redirect")
              loginFailed = false
              foundLogin = true
            } else {
              console.log("not a redirect")
              loginFailed = true
              foundLogin = true

            }
          } else if (request.url().includes("https://lilydaleheights-vic.compass.education/Services/LearningTasks.svc/GetAllLearningTasksByUserId")) {
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
    while (foundLogin === false) {
      console.log("waiting for login response")
      await sleep(250)
    }
    if (loginFailed === true) {
      console.log("login failed")
      res.status(400).send({message: "it no worke", error: "login failed"})
      return
    }
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
  let requestNumber = 0
  let loginFailed = false
  let foundLogin = false
  const username = req.query.username;
  const password = req.query.password;
  console.log("starting puppeteer")
  const browser = await puppeteer.launch({headless: true, "args" : ["--no-sandbox", "--disable-setuid-sandbox"]})
  console.log("opening new page")
  let page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", req => {
    if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
      req.abort();
    }
    else {
      req.continue()
    }
  })
  page.on('console', async (msg) => {
    const msgArgs = msg.args();
    for (let i = 0; i < msgArgs.length; ++i) {
      console.log(await msgArgs[i].jsonValue());
    }
  });
  page.on("requestfinished", async (request) => {
    if (request.url().includes("https://lilydaleheights-vic.compass.education/login.aspx")) {
      console.log(requestNumber)
      if (requestNumber !== 1) {
        requestNumber++
        return
      }
      if (request.response().status() >= 300 && request.response().status() <= 399) {
        console.log("is a redirect")
        loginFailed = false
        foundLogin = true
      } else {
        console.log("not a redirect")
        loginFailed = true
        foundLogin = true
        
      }
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
  while (foundLogin === false) {
    console.log("waiting for login response")
    await sleep(250)
  }
  if (loginFailed === true) {
    console.log("login failed")
    res.status(400).send({message: "it no worke", error: "login failed"})
    return
  }
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

app.get("/get/lessonplans", async (req, res) => {
  console.log("request received")
  if (!req.query.username || !req.query.password) {
    res.status(400).send("This ain't it chief")
    return
  }
  let i = 0
  let key = 0
  let requestNumber = 0
  let loginFailed = false
  let foundLogin = false;
  const response = [];
  let doneYet = {};
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
  page.on("request", request => {
    if(request.resourceType() == 'stylesheet' || request.resourceType() == 'font' || request.resourceType() == 'image'){
      request.abort();
    } else {
      request.continue()
    }
  })
  page.on("requestfinished", async (request) => {
    if (request.url().includes("https://lilydaleheights-vic.compass.education/login.aspx")) {
      console.log(requestNumber)
      if (requestNumber !== 1) {
        requestNumber++
        return
      }
      console.log("found request")
      if (request.response().status() >= 300 && request.response().status() <= 399) {
        console.log("is a redirect")
        loginFailed = false
        foundLogin = true
      } else {
        console.log("not a redirect")
        loginFailed = true
        foundLogin = true
        
      }
    } else if (request.response().url() === "https://lilydaleheights-vic.compass.education/Services/Activity.svc/GetLessonsByActivityId?sessionstate=readonly") { 
      console.log("found response")
      console.log(request.response().url())
      const res = await request.response().json()
      const responsebody = res.d
      let subject = {
        school_id: "",
        name: "",
        year: "",
        id: "",
        activity_id: "",
        lessons: [],
        teacher: "",
        teacher_code :"",
        teacher_image_url: "",
        attendee_ids: [],
      }
      subject.year = responsebody.AcademicYearLevel // year the subject took place in (2022)
      subject.name = responsebody.SubjectName // name of subject
      subject.school_id = responsebody.ActivityDisplayName // school code (7ENGA)
      subject.activity_id = responsebody.ActivityId // identifiable id 
      subject.id = responsebody.SubjectId // useless id but might mean something idk
      subject.teacher = responsebody.Instances[0].ManagerTextReadable
      subject.teacher_code = responsebody.Instances[0].m
      subject.teacher_image_url = "https://lilydaleheights-vic.compass.education" + responsebody.Instances[0].ManagerPhotoPath
      let instances = responsebody.Instances
      for (let j = 0; j<instances.length; j++) {
        let lesson = {
          key,
          location: "",
          teacher: "",
          teacher_code: "",
          teacher_image_url: "",
          display_time: "",
          start: "",
          finish: "",
          plan: {
            id: "",
            node_id: "",
            url: ""
          }
        }
        lesson.location = instances[j].l
        lesson.teacher = instances[j].ManagerTextReadable
        lesson.teacher_code = instances[j].m
        lesson.teacher_image_url = "https://lilydaleheights-vic.compass.education" + instances[j].ManagerPhotoPath
        lesson.display_time = instances[j].dt
        lesson.start = new Date(instances[j].st).getTime()
        lesson.end = new Date(instances[j].fn).getTime()
        if (instances[j].lp.fileAssetId !== null) {
          lesson.plan.id = instances[j].lp.fileAssetId
          lesson.plan.node_id = instances[j].lp.wnid
          lesson.plan.url = `https://lilydaleheights-vic.compass.education/Services/FileAssets.svc/DownloadFile?sessionstate=readonly&id=${instances[j].lp.fileAssetId}&nodeId=${instances[j].lp.wnid}`
        } else {
          lesson.plan = null
        }
        subject.lessons.push(lesson)
        key++
      }
      response.push(subject)
      doneYet[i] = true;
      console.log(doneYet)
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
  while (foundLogin === false) {
    console.log("waiting for login response")
    await sleep(250)
  }
  if (loginFailed === true) {
    console.log("login failed")
    res.status(400).send({message: "it no worke", error: "login failed"})
    return
  }
  console.log("waiting for compass homepage to load")
  await page.waitForSelector("#c_bar");
  console.log("sorting through subjects");
  const elements = await page.$$("#mnu_left > li:nth-child(4) > ul > li");
  const as = await page.evaluate(() => {
    let as = [];
    let element = document.querySelectorAll("#mnu_left > li:nth-child(4) > ul > li");
    for (let i = 0; i<element.length; i++) {
      if (element[i].innerHTML.includes("- ")) {
        as.push(element[i].querySelector("a").href);
      };
    };
    return as;
    
  });
  for (i; i<as.length; i++) {
    await page.goto(as[i]);
    while (!doneYet[i]) {
      console.log("waiting for response")
      await sleep(250);
    };
  };
  console.log("closing browser")
  await browser.close()
  console.log("sending response")
  res.status(200).send({message: "pog it worker", response_type: "lessonplans", response_data: response})
})

app.get("/get/studentinfo", async (req, res) => {
  console.log("request received")
  if (!req.query.username || !req.query.password) {
      res.status(400).send("This ain't it chief")
      return
  }
  let requestNumber = 0
  let loginFailed = false
  let foundLogin = false
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
    if (request.url().includes("https://lilydaleheights-vic.compass.education/login.aspx")) {
      console.log(requestNumber)
      if (requestNumber !== 1) {
        requestNumber++
        return
      }
      console.log("found request")
      if (request.response().status() >= 300 && request.response().status() <= 399) {
        console.log("is a redirect")
        loginFailed = false
        foundLogin = true
      } else {
        console.log("not a redirect")
        loginFailed = true
        foundLogin = true
      }
    } else if (request.url().includes("https://lilydaleheights-vic.compass.education/Services/User.svc/GetUserDetailsBlobByUserId")) {
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
          chronicles.push({name: field_name, description: description, values: value})
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
  while (foundLogin === false) {
    console.log("waiting for login response")
    await sleep(250)
  }
  if (loginFailed === true) {
    console.log("login failed")
    res.status(400).send({message: "it no worke", error: "login failed"})
    return
  }
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