var json = require("./compareReports.json");
var fs = require('fs');
var _ = require('./lodash');

function analyzeComparators(comparators, multiSelectMax, totalMax) {
   var compares = comparators.map(c => {
     c.location = c.location.id;
     c.provider = c.provider.id || undefined;
     c.device = c.device ? c.device.id || undefined : undefined;
     return c;
   })

   // merge all comparator objects to get possible keys.
   // [bandwidth_metric_type, mobile_market_type, provider, location]
   var result =  _.assign.apply(_, compares);
   var keys = Object.keys(result);
   var combined = {};

   // combine all possible keys into arrays.
   keys.map(key => {
     combined[key] = [...new Set(compares.filter(c => {
       return c[key] !== undefined;
     }).map(it => it[key]))];
   })

   // calculate total comparators and multiselects
   var multiSelects = 0;
   var totalComparators = 0;

   _.forEach(combined, function(value, key) {
     totalComparators = totalComparators + value.length;
     if (value.length > 1) {
       multiSelects = multiSelects + 1;
     }
   });

   // Breakup information that's returned in useful chunks.

   var maxComparators = {};
   var maxMultiSelects = {};

   var combinedFilters = {
     filters: combined,
   }
   var comparatorCounts = {
     totalComparators: totalComparators,
     totalMultiSelects: multiSelects,
   }
   var rawReports = {
     rawReports: comparators,
   };

   if (totalComparators > totalMax) {
     maxComparators = {
       filters: combined,
       totalComparators: totalComparators,
       totalMultiSelects: multiSelects,
     }
   }

   if ( multiSelects > multiSelectMax) {
     maxMultiSelects = {
       filters: combined,
       totalComparators: totalComparators,
       totalMultiSelects: multiSelects,
     }
   }

   var compare = {
     combinedFilters,
     comparatorCounts,
     maxComparators,
     maxMultiSelects,
     rawReports
   }

   return compare;
}



var count = 0;
var allInfo = {};
var maxComparators = {};
var maxMultiSelects = {};
var errors = {};
var urls = [];

// parse json from DB
for (var i = 0; i < json.length; i++) {
    var data = JSON.parse(json[i].data)
    var customerName = json[i].customer_name;
    var userName = json[i].first_name + ' ' + json[i].last_name;

    if (customerName) {
      var customerName = json[i].customer_name.split(' ').join('_');

      // Saved Reports
      var saved = data.savedReportsGoogle;
      if (saved && saved.length) {
        var nameKey = json[i].customer_id + '_' + customerName;

        // setup initial object for customer information
        var customer = allInfo[nameKey];
        if (!customer) {
          allInfo[nameKey] = {
            name:json[i].customer_name,
            user: userName,
            compareReportCount: 0,
            compareReports: []
          }
        }


        // Iteration through the saved reports of a single customer.
        for (var s = 0; s < saved.length; s++) {
          var savedReport = saved[s];

          // Only look at compare reports
          if (savedReport.type === 'compare') {

            // attempt to parse the url into json.
            var params = savedReport.url.replace('#compare', '').replace('?', '');
            if (params !== '') {
              try {
                urlParams = JSON.parse('{"' + params.replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(key, value) { return key===""?value:decodeURIComponent(value) });
                // parse comparators to be more readable.
                urlParams.comparators = JSON.parse(urlParams.comparators);

                // iteration comparators to determine if we have any metrics that have been exceeded by the limitations of the new UI.
                // params(comparators, maxMultiSelects, maxComparators);
                var analyzed = analyzeComparators(urlParams.comparators, 2, 15);

                if (analyzed.maxComparators && analyzed.maxComparators.filters) {
                  maxComparators[nameKey] = {
                    name:json[i].customer_name,
                    user: userName,
                    ...analyzed.maxComparators
                  }
                }

                if (analyzed.maxMultiSelects && analyzed.maxMultiSelects.filters) {
                  maxMultiSelects[nameKey] = {
                    name:json[i].customer_name,
                    user: userName,
                    ...analyzed.maxMultiSelects
                  }
                }

                urlParams.comparators = {
                  ...analyzed.combinedFilters,
                  ...analyzed.comparatorCounts,
                  ...analyzed.rawReports
                }


                allInfo[nameKey].compareReportCount = allInfo[nameKey].compareReportCount + 1;
                allInfo[nameKey].compareReports.push(urlParams);
                count = count + 1;
              } catch (e) {
                errors[nameKey] = {
                  user: userName,
                  reportWithError: savedReport,
                  errorMessage: e.message
                }
              }

            }
          }
        }
      }
    }

}

fs.writeFileSync('allReports.json', JSON.stringify(allInfo, null, 4));
fs.writeFileSync('maxComparators.json', JSON.stringify(maxComparators, null, 4));
fs.writeFileSync('maxMultiSelects.json', JSON.stringify(maxMultiSelects, null, 4));

fs.writeFileSync('errors.json', JSON.stringify(errors, null, 4));
