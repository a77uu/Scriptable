// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: calendar-alt;
const UserID = '';
const token = '';
const companyId = '';
const locationId = '';

// 班表颜色需在此定义
const sch_color = {
  "Sales 1": "#DCFFFF",
  "Sales 2": "#9933FF",
  "Sales 3": "#F08080",
  "Apple Pickup": "#DB7093",
  "PZ On Point": "#C71585",
  "PZ Training Development": "#33FF66",
  "Setup": "#00FFFF",
  "Avenues": "#FF1493",
  "Daily Download": "#545454",
  "Cycle Counts": "#545454",
  "Visuals": "#BA55D3",
  "Runner Restock": "#929000",
  "PZ Support": "#CD5C5C",
  "Break": "#696969",
  "Mobile Support": "#E0FFFF",
  "GB On Point": "#5FFFC7",
  "Mac Support": "#021A6E",
  "iPhone Repair": "#5849BC",
  "Mac Repair": "#032FBB",
  "Ready For Pick Up": "#05DCDC",
  "Service Training Development": "#33FF66",
  "Tech and Merch": "#757300"
}

// 先读取 Token 文件 之后再获取 用户 ID 保存到变量内
if (config.runsInWidget) {
  let widget = new ListWidget();
  await getWorkJamToken();
  let data = await getSchedule();
  if (data) {
    widget = await createWidget(data)
  }
  Script.setWidget(widget)
}



await getWorkJamToken();
await getLocationId();
let data = await getSchedule();
createWidget(data);

/**
 *  获取 iCloud 中的 WorkJam 数据
 */
async function getWorkJamToken()
{
  const fileManager = FileManager.iCloud();
  const iCloudDirectory = fileManager.documentsDirectory();
  const filePath = fileManager.joinPath(iCloudDirectory, 'workjam.txt');
  const fileExist = fileManager.fileExists(filePath)
  if (fileExist) {
    let tokenString = fileManager.readString(filePath)
    this.token = JSON.parse(tokenString).token
    this.UserID = JSON.parse(tokenString).userId.toString()
    this.companyId = JSON.parse(tokenString).employers[0].toString()
  } else {
    await fileManager.downloadFileFromiCloud(filePath);
    let tokenString = fileManager.readString(filePath)
    this.token = JSON.parse(tokenString).token
    this.UserID = JSON.parse(tokenString).userId.toString()
    this.companyId = JSON.parse(tokenString).employers[0].toString()
  }
}

async function getLocationId()
{
  const url = `https://api.workjam.com/api/v1/users/${this.UserID}/employers`
  const req = new Request(url);
  req.headers = {
    'Authorization': 'Bearer ' + this.token,
    'Cookie' : ""
  }
  req.method = 'GET';
  const data = await req.loadJSON();
  this.locationId = data.companies[0].stores[0].id
  console.log(this.locationId)
  return true;
}

/**
 *  获取所有活动的时间区间 (今明天 UTC 时间)
 */
async function getShiftDuration()
{
  const time = new Date();
  const year = time.getFullYear();
  const month = time.getMonth() + 1 > 10 ? time.getMonth() + 1 : '0' + (time.getMonth() + 1)
  const date = time.getDate() < 10 ? '0' + (time.getDate()) : time.getDate();
  const data = {
    startDateTime: `${year}-${month}-${date}T00:00:00%2B08:00`,
    endDateTime: `${year}-${month}-${date}T23:59:59%2B08:00`,
    includeOverLaps: true,
    types: '0=SHIFT'
  }
  console.log(data)
  return data;
}

/**
 *  获取所有活动
 */
async function getEvents()
{
  const params = await getShiftDuration()
  const url = `https://api.workjam.com/api/v4/companies/${this.companyId}/employees/${this.UserID}/events?startDateTime=${params.startDateTime}&endDateTime=${params.endDateTime}&includeOverlaps=true`    
  const req = new Request(url);
  req.headers = {
    'Authorization': 'Bearer ' + this.token,
    'Cookie' : ""
  }
  req.method = 'GET';
  const data = await req.loadJSON();
  console.log("Success Fetched Events")
  return Promise.resolve(data)
}

/**
 *  获取班表
 */
async function getSchedule()
{
  const events = await getEvents();
  if (!events[0]) {
    const script = noEvents()
    Script.setWidget(script)
    Script.complete()
    return false;
  }
  if (events[0].type !== 'SHIFT'){
	 console.log("今天没有班次")
	 const script = noEvents()
    Script.setWidget(script)
    Script.complete()
    return false;
  }
  const eventsId = events[0].id;
  console.log("Fetched the Event id" + events[0].id)
  const url = `https://api.workjam.com/api/v4/companies/${this.companyId}/locations/${this.locationId}/shifts/${eventsId}`
  const req = new Request(url);
  req.headers = {
    'Authorization': 'Bearer ' + this.token,
    'Cookie' : ""
  }
  const data = await req.loadJSON();
  console.log(data)
  const schedual = await returnData(data.segments);
  return Promise.resolve(schedual);
}

async function createWidget(data)
{
  if (data.length == 0) {
    const script = noEvents();
    return script
  }
  const widget = new ListWidget();
  
  widget.setPadding(0, 0, 0, 0);
  // Main Content Container
  const contentContainer = widget.addStack();
  // Left Container
  const leftContent = contentContainer.addStack();
  leftContent.layoutVertically();
  leftContent.addSpacer()
  let total = data.length < 3 ? data.length : 3
  // If total < 3 return the truly length, else return the first three
  for(i = 0; i < total; i++) {
      let row = leftContent.addStack();
      row.addSpacer(8);
      row.centerAlignContent();
      let name = data[i].position.name
      let image = row.addImage(await draw(data[i].type == 'SHIFT' ? sch_color[name] ? sch_color[name] : "#838383" : '#838383'), false)
      image.resizable = false;
      image.centerAlignImage();
      row.addSpacer(5);
      let title = row.addStack();
      title.layoutVertically();
      if (data[i].type == 'SHIFT') {
        let titleFont = title.addText(name)
        titleFont.lineLimit = 1;
        titleFont.font = Font.semiboldSystemFont(15)
      } else {
        let titleFont = title.addText('Break')
        titleFont.font = Font.semiboldSystemFont(15)
        titleFont.lineLimit = 1;
      }
      let titleTime = title.addText(await timeFormat(data[i].startDateTime, data[i].endDateTime))
      titleTime.font = Font.regularSystemFont(15)
      title.addSpacer(2);
      row.addSpacer();
  }
  leftContent.addSpacer()
  // If data length > 3 append a right container
  if (data.length > 3) {
    let count = data.length < 6 ? data.length - 3 : 3;
    const rightContent = contentContainer.addStack();
    rightContent.addSpacer()
    rightContent.layoutVertically();
    for(i = 0; i < count; i ++) {
      const current = i + 3;
      let name = data[current].position.name
      let row = rightContent.addStack();
      row.addSpacer(3);
      row.centerAlignContent();
      let image = row.addImage(await draw(data[current].type == 'SHIFT' ? sch_color[name] ? sch_color[name] : "#838383" : '#838383'), false)
      image.resizable = false;
      image.centerAlignImage();
      row.addSpacer(5);
      let title = row.addStack();
      title.layoutVertically();
      if (data[current].type == 'SHIFT') {
        let titleFont = title.addText(name)
        titleFont.lineLimit = 1;
        titleFont.font = Font.semiboldSystemFont(15)
      } else {
        let titleFont = title.addText('Break')
        titleFont.lineLimit = 1;
        titleFont.font = Font.semiboldSystemFont(15)
       }
      let titleTime = title.addText(await timeFormat(data[current].startDateTime, data[current].endDateTime))
      titleTime.font = Font.regularSystemFont(15)
      title.addSpacer(2);
      row.addSpacer();
      
    }
    rightContent.addSpacer()
  }
  // Footer Update Time
  const footer = widget.addStack();
  footer.addSpacer()
  const dateString = footer.addText("Last Update: " + getCurrentTime());
  dateString.rightAlignText()
  dateString.font = Font.regularSystemFont(11)
  footer.addSpacer()
  widget.addSpacer()
  widget.presentMedium();
  
  return widget;
}

async function draw(color)
{
  let d = new DrawContext();
  d.opaque = false;
  d.respectScreenScale = true;
  d.size = new Size(20, 20);
  d.setFillColor(new Color(color))
  d.setLineWidth(5);
  d.fillEllipse(new Rect(6, 6, 12, 12));
  let img = d.getImage(); 
  return img;
}

function addZero(time)
{
  return time < 10 ? '0' + time : time;
}

async function timeFormat(startTime, endTime)
{
  return new Promise((resolve, reject) => {
    let startHour = addZero(new Date(startTime).getHours())
    let startMin = addZero(new Date(startTime).getMinutes())
    let endHour = addZero(new Date(endTime).getHours())
    let endMin = addZero(new Date(endTime).getMinutes())
    resolve(`${startHour}:${startMin} - ${endHour}:${endMin}`)
  })
}

// 返回目前剩余的细则班表
async function returnData(data) 
{
    const array = [];
    return new Promise((resolve, reject) => {
        data.forEach((item, index) => {
          let currentTime = new Date();
          let endTime = new Date(item.endDateTime)
          if (currentTime < endTime) {
            array.push(item)
          }
        })
        
        resolve(array)
    })
}

// 返回一个没有事件的小组件
function noEvents() 
{  
    const widget = new ListWidget()
    
    const content = widget.addStack()
    content.layoutVertically();
    content.addSpacer()
    const title = content.addStack()
    title.addSpacer()
    title.addText("☕️ 没有事件")
    title.addSpacer()
    content.addSpacer()
    const timeWidget = widget.addStack();
    timeWidget.addSpacer()
    const timeText = timeWidget.addText("Last Update: " + getCurrentTime())
    
    timeWidget.addSpacer()
    widget.presentMedium();
    return widget;
}

function getCurrentTime()
{  
    var nowTime = new Date();
    var hour = nowTime.getHours();
    var minute = nowTime.getMinutes();
    var second = nowTime.getSeconds();
    hour = hour < 10 ? '0' + hour : hour;
    minute = minute < 10 ? '0' + minute : minute;
    second = second < 10 ? '0' + second : second;
    return hour + ':' + minute + ':' + second;
}