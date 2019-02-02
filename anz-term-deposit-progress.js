// ==UserScript==
// @name         [ANZ]Term Deposit Progress Bar
// @namespace    https://github.com/e10101/anz-online-banking-ui
// @version      0.1
// @description  Adding term deposit process bar to the ANZ UI.
// @author       You
// @match        https://*.anz.co.nz/IBCS/service/home
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var modify = function() {

        function days_between(date1, date2) {

            // The number of milliseconds in one day
            var ONE_DAY = 1000 * 60 * 60 * 24

            // Convert both dates to milliseconds
            var date1_ms = date1.getTime()
            var date2_ms = date2.getTime()

            // Calculate the difference in milliseconds
            var difference_ms = Math.abs(date1_ms - date2_ms)

            // Convert back to days and return
            return Math.round(difference_ms/ONE_DAY)

        }

        $(".account-term-deposit-info").each(function(idx, item) {
            var str = $(item).text();
            var maturity_date = Date.parse(str);
            var now = Date.now();
            var remains = days_between(new Date(maturity_date), new Date(now))

            var total_days = + $(item).parent().find(".account-description").text().split("days")[0].trim();

            var new_dom =`<div id="days">
<span class="remains" style="font-weight: bold;">${total_days - remains}</span>
<span class="separator">/</span>
<span class="total_days">${total_days}</span>
</div>`;

            var bar_dom = `
<div style="
margin-bottom: -12px;
margin-top: 12px;
height: 10px;
background-color: #f0f0f0;
">
<div style="
background-color: #007dba;
height: 100%;
width: ${(total_days - remains) / total_days * 100}%;
"></div>
</div>
`;

            $(item).parents(".media-body").after(new_dom);
            $(item).parents(".account-id-overview").after(bar_dom);
        });
    }

    var interval = setInterval(
        function() {
            var str = $($(".account-term-deposit-info")[0]).text();

            if (str) {
                // console.log("Found");
                modify();
                clearInterval(interval);
                console.groupEnd();
            } else {
                // console.log("not found");
            }
        }, 100);

})();
