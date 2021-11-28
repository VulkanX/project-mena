//*3rd Party Libraries
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const koa = require('koa');
const koaRouter = require('koa-router');
const koaRender = require('koa-ejs');

//*Const Variables
var memexNewArrivalData = [];
var lastCheckDate = Date().toString();

//*Web server Code
var server = new koa();
var router = koaRouter();

server.use(router.routes());
koaRender(server, {
    root: path.join(__dirname, "views"),
    layout: "index",
    viewExt: "html"
});

router.get('/', async (ctx) =>{ 
    return ctx.render("index", {
        data: memexNewArrivalData,
        lastCheckDate
    });
});

server.listen(3000);

//*Scrapping Functions
const getNewArrivals = async () => {
    //Place Store new Arrival Data for processing
    const newArrivalData = [];

    try {
        //Get Website Data
        const res = await axios.get('https://www.memoryexpress.com/Catalog/NewArrivals?Sort=DateDesc&PageSize=120');
        
        //Make sure server response is valid
        if (res.status !== 200) throw('Invalid HTML response');

        // Store HTML Data
        const htmlData = res.data;

        // Load valid HTML into Cheerio for processing
        const $ = cheerio.load(htmlData);

        //Scrape all the new arrival data we want including image urls
        $('.c-shca-container > div').each((id, el) => {

            brand = $(el).find('.c-shca-icon-item__body-name > a > span > img').prop('alt') || $(el).find('.c-shca-icon-item__body-name > a > span').text().trim();
            if(brand) {
                description = $(el).find('.c-shca-icon-item__body-name > a').children().remove().end().text().trim();
                partno = $(el).find('.c-shca-icon-item__body-ref > span').text().trim();
                producturl = $(el).find('.c-shca-icon-item__body-name > a').prop('href') || ''
                imgurl = $(el).find('.c-shca-icon-item__body-image > a > img').prop('data-lazy-src') || ''
                price = $(el).find('.c-shca-icon-item__summary-list > span').first().text().trim().replace(/[$|,]/g, '');
                regprice = $(el).find('.c-shca-icon-item__summary-regular > span').text().trim().replace(/[$|,]/g, '');

                newArrivalData.push({
                    brand,
                    description,
                    partno,
                    producturl,
                    imgurl,
                    price,
                    regprice
                });
            }
        });
        return(newArrivalData);
    } catch (err) {
        console.log(err)
    }
}

const updateArrivalData = async (newData) => {
    console.log('Updating New Arrivals...');

    //loop through the new array
    newData.forEach(item => {

        //Check to see if partno exists
        checkval = memexNewArrivalData.findIndex(part => part.partno === item.partno);

        //if Check Interval
        if(checkval === -1) { 
           memexNewArrivalData.unshift(item) // Store new Item
           if(memexNewArrivalData.length > 200) {
               memexNewArrivalData.pop(); // if array is longer than 200 then remove an item to keep the array at 200
           }
        }
    });
}

(async () => {

    //pull Initial Data
    memexNewArrivalData = await getNewArrivals();
    console.log(memexNewArrivalData);

    //Setup Scheduling for every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        updateArrivalData(await getNewArrivals());
        lastCheckDate = Date().toString();
    });
    
})();
