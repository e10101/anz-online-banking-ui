// ==UserScript==
// @name         [ANZ] Display Total and Sub Total Amount on Home Page
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Tracking Your Money At ANZ.
// @author       Yishi Guo
// @match        https://*.anz.co.nz/IBCS/service/home
// @require      https://code.highcharts.com/highcharts.js
// @grant        GM_listValues
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==
(function () {
    'use strict';

    const doUpdate = () => {
        let isShowChart = false;
        const chartName = 'balance-chart';

        console.group('DEBUG');

        const addStyles = () => {
            const styles = `
            #${chartName} {
                transition: height ease-in-out 0.5s, opacity ease-in-out 0.3s;
                height: 400px;
                opacity: 1;
            }
            #${chartName}.hide-chart {
                height: 0px;
                opacity: 0;
            }
            `;

            var style=document.createElement('style');
            style.type='text/css';
            if(style.styleSheet){
                style.styleSheet.cssText=styles;
            }else{
                style.appendChild(document.createTextNode(styles));
            }
            document.getElementsByTagName('head')[0].appendChild(style);
        };

        const getSubTotal = (group) => {
            let sum = 0;
            $(`.account-group.${group.type} .hidden-sm .account-balance .balance.currency`).each((idx, item) => {
                const text = $(item).text().trim();
                const num = text.replace(/[ODCR$,]+/g, "");

                let value = +num;

                if (!group.positive && text.indexOf('CR') === -1) {
                    value *= -1;
                }

                if (text.indexOf('OD') >= 0) {
                    value *= -1;
                }

                sum += value;

                console.log(text, num, value);
            });

            console.log('sum', sum);

            return sum;
        };

        // ----------------------
        const getCurrencyString = (num) => {

            const currency = num.toLocaleString('nz-NZ', {
                'minimumFractionDigits': 2
            });

            return '$' + currency;
        };

        // ----------------------
        const updateSubTotalLabel = (group) => {
            console.log('group', group);
            const currency = getCurrencyString(group.amount);
            const sumDom = `<span style="color: #004165; margin-left: 8px;">${currency}</span>`;
            const type = group.type;
            $(`.account-group.${type} h2.heading`).append(sumDom);
        };

        // -----------------------
        const updateTotalLabel = (total) => {
            const currency = getCurrencyString(total);
            const dom = `<span style="color: #004165; margin-left: 8px;">${currency}</span>`;
            $('h1.page-heading').append(dom);
        };

        // ----------------------
        const displayCurrentTime = () => {
            const date = new Date();
            const dom = `<div style="color: #747678; font-size: 14px;">
            ${date}
            <button class="btn btn-link has-icon btn-chevron icon-acc-kiwisaver" id="chartTrigger">Balance Chart</button>
            <!--button class="btn btn-link" id="removeAllData">
				Clear Data
            </button-->
            <!--
            <button class="btn btn-link" id="removeLastHourData">
				Clear Last One Hour Data
            </button>
            -->
            </div>`;
            $('h1.page-heading').append(dom);

            $('#chartTrigger').on('click', () => {
                if (isShowChart) {
                    $(`#${chartName}`).addClass('hide-chart');
                    $('#chartTrigger').removeClass('open')
                } else {
                    $(`#${chartName}`).removeClass('hide-chart');
                    $('#chartTrigger').addClass('open');
                }

                isShowChart = !isShowChart;
            });
            $('#removeAllData').on('click', () => {
                deleteAllValues();
            });
            $('#removeLastHourData').on('click', () => {
                deleteLastHourValues();
            });
        };

        // ------------------------------
        const addTotalAmountToGroups = (groups, total) => {
            groups.unshift({
                amount: total,
                type: "total",
                name: "Total",
                chartType: 'spline',
                visible: true,
            });
        };

        // ----------------------
        const saveInfoToGM = (info) => {
            const key = `LOG_${info.createdAt}`;
            const value = info;

            GM_setValue(key, value);
        };

        //
        const deleteAllValues = () => {
            const list = GM_listValues();
            list.forEach((item) => {
                console.log('deleting', item);
                GM_deleteValue(item);
            });
        };

        const deleteLastHourValues = () => {
            const list = GM_listValues();

            const oneHourBefore = new Date(Date.now() - 1000 * 60 * 60);
            list.forEach((item) => {
                const content = GM_getValue(item);
                if (content && content.createdAt && new Date(content.createdAt) > oneHourBefore) {
                    console.log('should remove', content);
                    GM_deleteValue(item);
                }
            });
        }


        //
        const clearDuplicatedValues = () => {
            const list = GM_listValues();

            console.log('list', list);

            let first = {
                key: '',
                value: '',
            };
            let second = {
                key: '',
                value: '',
            };

            list.forEach((key) => {
                const content = GM_getValue(key);

                console.log('--------key', key);

                const groupStr = JSON.stringify(content.groups);

                // console.log('groupStr', groupStr);

                if (first.value !== groupStr) {
                    // Change First
                    first.key = key;
                    first.value = groupStr;

                    second.key = '';
                    second.value = '';
                } else {
                    if (second.value !== groupStr) {
                        second.key = key;
                        second.value = groupStr;
                    } else {
                        const needBeRemovedKey = second.key;
                        second.key = key;
                        second.value = groupStr;

                        console.log('need remove', needBeRemovedKey);
                        GM_deleteValue(needBeRemovedKey);
                    }
                }

                // GM_deleteValue(item);
            });
        };

        //
        const listGMValues = () => {
            const list = GM_listValues();

            list.sort();

            console.log('list', list);

            const results = [];

            let fakeOffset = 0;

            list.forEach((item) => {
                const content = GM_getValue(item);

                console.log(item, content, JSON.stringify(content.groups));

                results.push([
                    (new Date(content.createdAt)).getTime(),
                    content.total,
                ]);
                // GM_deleteValue(item);
            });

            return results;
        };

        ///
        const getHistoricalData = () => {
            const list = listGMValues();

            console.log('list', list);

            return list;
        };

        const getSeriesData = (seriesTemplate) => {
            const list = GM_listValues();

            const seriesInfo = {};

            seriesTemplate.forEach((group) => {
                const id = group.type;
                const name = group.name;
                const chartType = group.chartType;
                const visible = !!group.visible;

                if (!seriesInfo[id]) {
                    seriesInfo[id] = {
                        id,
                        name,
                        data: [],
                        fakeAmount: 0,
                        type: chartType,

                        visible,
                    }
                }
            })

            list.forEach((key) => {
                const item = GM_getValue(key);
                const groups = item.groups;
                const createdAt = item.createdAt;

                if (groups) {
                    groups.forEach((group) => {
                        const id = group.type;
                        const name = group.name;
                        const amount = group.amount;
                        const chartType = group.chartType;

                        if (!seriesInfo[id]) {
                            seriesInfo[id] = {
                                id,
                                name,
                                data: [],
                                fakeAmount: 0,
                                type: chartType,
                            }
                        }

                        const fakeAmount = seriesInfo[id].fakeAmount += 500 * (Math.random() - 0.5);

                        seriesInfo[id].data.push(
                            [
                                (new Date(createdAt)).getTime(),
                                amount,
                                // fakeAmount,
                            ]
                        );
                    })
                }
            });

            // {
            //     id: "amount",
            //     name: 'Amount',
            //     data: data,
            //     color: '#007dba',
            // }

            console.log('list', list);
            console.log('seriesInfo', seriesInfo);

            const series = Object.values(seriesInfo);

            series.forEach((row) => {
                row.data.sort((a, b) => {
                    return new Date(a[0]) - new Date(b[0]);
                });
            });

            console.log('series', series);

            return series;
        };

        // ------------------------
        const getDateString = (date) => {
            var options = { year: 'numeric', month: 'long', day: 'numeric' };
            return date.toLocaleDateString('nz-NZ', options);
        };

        const getMinMaxDates = (data) => {
            let min = new Date();
            let max = new Date('2000-01-01');


            data.forEach((item) => {
                console.log('item', item, item[0]);

                const createdAt = new Date(item[0]);
                console.log('createdAt', createdAt);
                if (createdAt < min) {
                    min = createdAt;
                }
                if (createdAt > max) {
                    max = createdAt;
                }
            });

            return {
                min,
                max,
            };
        }

        const getInitialValue = (data) => {
            return data[0][1];
        }
        const createChart = (container, series) => {
            // const {min, max} = getMinMaxDates(data);
            // const firstBalance = getInitialValue(data);

            Highcharts.chart(container, {
                credits: {
                    enabled: false,
                },
                chart: {
                    // type: "area",
                    height: '400px',
                },
                title: {
                    text: 'Historical Balance'
                },
                subtitle: {
                    // text: `From <b>${getDateString(min)}</b> to <b>${getDateString(max)}</b>`,
                    useHTML: true,
                },
                series: series,


                legend: {
                    enabled: true,
                },
                time: {
                    useUTC: false,
                },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: { // don't display the dummy year
                        month: '%e. %b',
                        year: '%b'
                    },
                    title: {
                        text: 'Date'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Total Balance (NZD)'
                    },
                    labels: {
                        formatter: function() {
                            const currency = this.value.toLocaleString('nz-NZ', {
                                'minimumFractionDigits': 2
                            });

                            return '$' + currency;
                        },
                        useHTML: true,
                    }
                },

                plotOptions: {
                    spline: {
                        marker: {
                            enabled: true
                        }
                    },

                    area: {
                        stacking: 'normal',
                    },
                },

                tooltip: {
                    pointFormatter: function() {
                        // console.log('this', this);

                        const firstBalance = 0;

                        const currency = this.y.toLocaleString('nz-NZ', {
                            'minimumFractionDigits': 2,
                        });

                        const offsetCurrency = (this.y - firstBalance).toLocaleString('nz-NZ', {
                            'minimumFractionDigits': 2,
                        });

                        const time = new Date(this.x).toLocaleString();

                        return `<tr><td style="padding-right: 16px;"><span style="color:${this.color}">\u25CF</span> ${this.series.name}:</td><td align="right"><b>$${currency}</b></td></tr>`;

                        return `<br>${time}<br />`;

                        return `<span style="color:{this.point.color}">\u25CF</span> {this.series.name}: <b>{point.y}</b><br/>`;

                        if (this.y - firstBalance >= 0) {
                            return `<b style="color: ${this.color}">${this.series.name}</b><br/><b>$${currency}</b><br><span style="color: green;">+${offsetCurrency}</span><br>${time}`;
                        } else {
                            return `<b>${this.series.name}</b><br/><b>$${currency}</b><br><span style="color: red;">${offsetCurrency}</span><br>${time}`;
                        }

                    },
                    headerFormat: `<span style="font-size: 10px">{point.key}</span> <table>`,
                    footerFormat: '</table>',
                    shared: true,
                    useHTML: true,
                    padding: 5,
                    borderRadius: 5,
                    shadow: false
                },
            });
        };

        // ------
        const createChartContainer = (name) => {
            const dom = `<div id="${name}" class="hide-chart"></div>`;
            $('h1.page-heading').parent().after(dom);
        };

        // -----------------------

        const groups = [
            {
                type: 'im',
                name: 'Current and Savings',
                positive: true,
                amount: 0,
                chartType: 'area',
            },
            {
                type: 'cc',
                name: 'Credit Cards',
                positive: false,
                amount: 0,
                chartType: 'area',
            },
            {
                type: 'td',
                name: 'Term Deposits',
                positive: true,
                amount: 0,
                chartType: 'area',
            },
            {
                type: 'investment',
                name: 'Investments',
                positive: true,
                amount: 0,
                chartType: 'area',
            },
            {
                type: 'pie',
                name: 'PIE Fund',
                positive: true,
                amount: 0,
                chartType: 'area',
            },
        ];


        // ----------------------
        let total = 0;

        addStyles();

        groups.forEach((group) => {
            const subTotal = getSubTotal(group);
            group.amount = subTotal;

            updateSubTotalLabel(group);

            total += subTotal;
        });

        updateTotalLabel(total);

        console.log('groups', groups);

        addTotalAmountToGroups(groups, total);

        displayCurrentTime();

        const info = {
            createdAt: new Date(),
            total: total,
            groups: groups,
        };

        createChartContainer(chartName);

        saveInfoToGM(info);

        clearDuplicatedValues();

        // listGMValues();
        const data = getHistoricalData();
        const series = getSeriesData(groups);

        createChart(chartName, series);


        console.groupEnd();
    };

    console.group('LOADING');
    const interval = setInterval(
        function () {
            const str = $($("#account-groups")[0]).text();

            if (str) {
                clearInterval(interval);
                console.log("Account Loaded");
                console.groupEnd();

                doUpdate();
            } else {
                console.log("loading...");
            }
        },
        100
    );
})();
