#!/usr/local/bin/node

// install: npm i
// usage: tsc scrape.ts && node scrape.js +CountryCodePhoneNumber `which aws` | tee scrape-output.org

// alerts go out via AWS CLI to SNS. you will need to have aws sns set up already and the above number should be in your sandbox.
// you should also set up bitly links for the urls you want to monitor.
// this script is specialized for unifi store urls. YMMV if you want to monitor other sites.

const path      = require ('path');
const puppeteer = require ('puppeteer');
const { exec }  = require ('child_process');

let phonenumber = process.argv[2];
let awscli      = process.argv[3];

const urls = [ [ "https://sg.store.ui.com/collections/unifi-protect/products/unifi-protect-g4-dome-camera", "https://bit.ly/3R6ydwM" ],
               [ "https://sg.store.ui.com/collections/unifi-protect/products/unifi-video-camera-g3-dome",   "https://bit.ly/3NBpOyd" ],
//               [ "https://sg.store.ui.com/collections/unifi-protect/products/uvc-g4-doorbell",              "https://bit.ly/3I8mfyB" ]
               ]

var sleepLoop = 170; // seconds
var alertCount = 0;
const maxAlerts = 3;

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

(async () => {
  const browser = await puppeteer.launch();
  const pagecache = { };

  do {
    const now = new Date().toISOString();
    console.log("* " + now);

    for (let n in urls) {
      let url   = urls[n][0];
      let bitly = urls[n][1];
      const bname = path.basename(url);
      console.log("** loading " + bname);
      const page = pagecache[url] = pagecache[url] || await browser.newPage();
      await page.goto(url);
      // await page.setViewport({ width: 1920, height: 3080, }); await page.screenshot({path: bname + '.png'});
      
      let selected = await page.evaluate(() => {
        return document.querySelector('div.comProduct__button').querySelectorAll("*");
      });
      console.log("** JSON"); console.log(JSON.stringify(selected, null, 2));
      for (let cn in selected) {
        let s = selected[cn];
        if (s._prevClass.includes("icon-cart")) {
          console.log("* " + bitly + " is buyable!");

          console.log("will save to " + bname + ".png");
          await page.setViewport({ width: 1920, height: 3080, }); await page.screenshot({path: bname + '.png'});

          alertCount = alertCount + 1;
          sleepLoop = sleepLoop * 3;

          if (alertCount > maxAlerts) {
            console.log("alerted " + maxAlerts + " times, exiting");
            process.exit();
          }
          
          console.log("sending alert.");
          exec(`${awscli} sns publish --phone-number '${phonenumber}' --message '${bitly} ${bname} is buyable ${now}'`,
               (error, stdout, stderr) => {
                 if (error) {
                   console.log(`error: ${error.message}`);
                   return;
                 }
                 if (stderr) {
                   console.log(`stderr: ${stderr}`);
                   return;
                 }
                 console.log(`stdout: ${stdout}`);
               });
        }
      }
      await delay(5 * 1000);
    }
    console.log("** sleeping " + sleepLoop + " seconds");
    await delay(sleepLoop * 1000);
    console.log("** sleep done");
  } while (true);
  
  await browser.close();
})();



//           <div class="comProduct__button flex-grow-1 add8left">
//             <template v-if="!hasSoldOutFlag && currentVariant.available && !currentVariant.inventory_empty">
//               <button id="addToCart" type="button" class="btn btn--full" @click="addToCart">
//                 <span class="text">Add to Cart</span>
//                 <span class="icon icon-cart"></span>
//               </button>
//             </template>
// 
//             <template v-else-if="!hasSoldOutFlag && currentVariant.available && currentVariant.allow_preorder">
//               <button type="button" class="btn btn--full" @click="addToCart">
//                 <span class="text">Pre-Order</span>
//                 <span class="icon icon-cart"></span>
//               </button>
//             </template>
// 
//             <template v-else>
//               <button
//                 type="button"
//                 class="btn"
//                 :class="{ 'btn--full': !canShowBackInStockNote }"
//                 disabled
//                 v-if="comingSoon"
//               >
//                 <span class="text">Coming Soon</span>
//               </button>
//               <span class="comProduct__badge comProduct__badge--muted" v-else>Sold Out</span>
//             </template>
//           </div>
//         </div>

