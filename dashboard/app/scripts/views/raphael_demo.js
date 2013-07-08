/*global define*/
'use strict';
define(['underscore', 'backbone', 'helpers/raphael_support', 'jquery', 'bootstrap', 'helpers/generate-osds', 'views/application-view', 'models/application-model', 'raphael'], function(_, Backbone, rs, $, bs, generate, View, models) {

    var originX = 0,
        originY = 0,
        step = 40,
        osds = 16 * 10,
        width = 17 * step,
        height = 11 * step;
    var legendCircle = function(r, originX, originY, percent) {
            var m = new models.OSDModel({
                capacity: 1024,
                used: percent * 1024
            });
            var c = r.circle(originX, originY, 16 * m.getUsedPercentage()).attr({
                fill: m.getCapacityColor(),
                stroke: 'none',
                'cursor': 'default',
                opacity: 0
            });
            var aFn = window.Raphael.animation({
                opacity: 1
            }, 250, 'easeOut');
            var text = percent * 100;
            if (text <= 40 || text === 70 || text === 100) {
                text = text.toString();
            } else {
                text = '\xBA';
            }
            r.text(originX, originY + 30, text).attr({
                'cursor': 'default',
                'font-size': '12px',
                'font-family': 'ApexSansLight'
            });
            return c.animate(aFn);
        };
    var drawLegend = function(r, originX, originY) {
            var xp = originX,
                i;
            for (i = 4; i <= 10; i += 1, xp += 32) {
                legendCircle(r, xp, originY, i / 10);
            }
        };
    var animateCircle = function(r, originX, originY, radius, destX, destY, model) {
            var c = r.circle(originX, originY, 20 * model.getUsedPercentage()).attr({
                fill: model.getCapacityColor(),
                stroke: 'none'
            });
            c.data('modelid', model.cid);
            var t;
            var aFn = window.Raphael.animation({
                cx: destX,
                cy: originY
            }, 250, 'easeOut', function() {
                c.animate({
                    cx: destX,
                    cy: destY
                }, 333, 'easeIn', function() {
                    t = r.text(destX, destY, model.get('index')).attr({
                        font: '',
                        stroke: '',
                        fill: '',
                        style: ''
                    });
                    t.data('modelid', model.cid);
                });
            });
            model.view = c;
            return c.animate(aFn);
        };

    var d = $.Deferred(function() {
        var w = 720,
            h = 520;
        var r = window.Raphael('viz', w, h);
        var path = rs.calcGrid(originX, originY, width, height, step);
        var path1 = r.path('M0,0').attr({
            'stroke-width': 1,
            'stroke': '#5e6a71',
            'opacity': 0.40
        });

        drawLegend(r, 250, 485);

        var collection = generate.osds(osds);
        var raphdemo = {
            collection: collection
        };

        var anim = window.Raphael.animation({
            path: path,
            callback: function() {
                d.resolve(r, raphdemo);
            }
        }, 250);
        path1.animate(anim);
    });
    var p = d.promise();
    p.then(function(r, raphdemo) {
        raphdemo.collection.each(function(m) {
            //console.log(m.attributes);
            var pos = rs.calcPosition(m.get('index'), originX, originY, width, height, step);
            animateCircle(r, originX, originY, 8, pos.nx, pos.ny, m);
        });
        return $.Deferred().resolve(r, raphdemo);
    }).then(function(r, raphdemo) {
        var simulateUsedChanges = function() {
                raphdemo.collection.each(function(m) {
                    var capacity = m.get('capacity');
                    var change = Math.floor(capacity * Math.random());
                    m.set('used', change);
                });
                window.vent.trigger('updateTotals');
            };

        var resetChanges = function() {
                raphdemo.collection.each(function(m) {
                    var capacity = m.get('capacity');
                    var change = capacity * 0.05;
                    m.set('used', change);
                });
                window.vent.trigger('updateTotals');
            };
        raphdemo.simulateUsed = simulateUsedChanges;
        raphdemo.resetChanges = resetChanges;
        var timer = null;
        raphdemo.startSimulation = function() {
            timer = setTimeout(function() {
                simulateUsedChanges();
                timer = raphdemo.startSimulation();
            }, 3000);
            return timer;
        };
        raphdemo.stopSimulation = function() {
            clearTimeout(timer);
            timer = null;
        };
        var parentOffset = $('svg').offset();
        console.log('parentOffset ', parentOffset);
        var detailPanel = new View();
        detailPanel.setElement($('.detail tbody'));
        $('svg').on('click', function(evt) {
            if (evt.target.nodeName === 'tspan' || evt.target.nodeName === 'circle') {
                var x = evt.clientX;
                var y = evt.clientY;
                //console.log(x + ' / ' + y);
                var el = r.getElementByPoint(x, y);
                //console.log(el);
                if (el) {
                    var cid = el.data('modelid');
                    //console.log(cid);
                    if (cid) {
			// ignore circles and tspans without data
                        detailPanel.model.set(raphdemo.collection.get(cid).attributes);
                    }
                    return;
                }
            }
        });
        $('body').on('keyup', _.debounce(function(evt) {
            evt.preventDefault();
            if (!evt.keyCode) {
                return;
            }
            console.log('got ' + evt.keyCode);
            var keyCode = evt.keyCode;
            if (keyCode === 82) {
                raphdemo.resetChanges();
                return;
            }
            if (keyCode === 85) {
                raphdemo.simulateUsed();
                return;
            }
            if (keyCode === 32) {
                var $spinner = $('.icon-spinner');
                if (timer === null) {
                    raphdemo.startSimulation();
                    $spinner.closest('i').addClass('.icon-spin').show();
                } else {
                    raphdemo.stopSimulation();
                    $spinner.closest('i').removeClass('.icon-spin').hide();
                }
            }
        }, 250, true));
        return $.Deferred().resolve(r, raphdemo);
    });
    return p;
});