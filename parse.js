var json = require("./compareReports.json");
var fs = require('fs');
var _ = require('./lodash');

function analyzeComparators(comparators, multiSelectMax, totalMax) {
   var modifiedComparators = comparators.map(c => {
     c.location = c.location.id;
     c.provider = c.provider.id || undefined;
     c.device = c.device ? c.device.id || undefined : undefined;
     return c;
   })

   // merge all comparator objects to get possible keys.
   // [bandwidth_metric_type, mobile_market_type, provider, location]
   var result =  _.assign.apply(_, modifiedComparators);
   var keys = Object.keys(result);
   var filters = {};

   // combine all possible keys into arrays.
   keys.map(key => {
     filters[key] = [...new Set(modifiedComparators.filter(c => {
       return c[key] !== undefined;
     }).map(filter => filter[key]))];
   })

   // separate fixed and carrier providers into separate items
   filters.carrier_providers = _.filter(_.uniq(_.filter(modifiedComparators, c => c.mobile_market_type).map(c => c.provider)), c => Boolean(c));
   filters.fixed_providers = _.filter(_.uniq(_.filter(modifiedComparators, c => c.platform).map(c => c.provider)), c => Boolean(c));

   // calculate total comparators and multiselects
   var multiSelects = 0;

   var totalCarrierComparators =
     _.get(filters, 'carrier_providers.length')
     * (_.get(filters, 'device.length') || 1)
     * (_.get(filters, 'mobile_market_type.length') || 1)
     * (_.get(filters, 'location.length') || 1)
     * (_.get(filters, 'bandwidth_metric_type.length') || 1);

   var totalFixedComparators =
     _.get(filters, 'fixed_providers.length')
     * (_.get(filters, 'platform.length') || 1)
     * (_.get(filters, 'location.length') || 1)
     * (_.get(filters, 'bandwidth_metric_type.length') || 1);

   var totalComparators = totalCarrierComparators + totalFixedComparators;

   _.forEach(filters, function(value, key) {
     if (value.length > 1) {
       multiSelects = multiSelects + 1;
     }
   });

   // Breakup information that's returned in useful chunks.

   var maxComparators = {};
   var maxMultiSelects = {};

   var combinedFilters = {
     filters,
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
       filters,
       totalComparators: totalComparators,
       totalMultiSelects: multiSelects,
     }
   }

   if ( multiSelects > multiSelectMax) {
     maxMultiSelects = {
       filters,
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
