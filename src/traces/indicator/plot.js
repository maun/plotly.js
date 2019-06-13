/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var d3 = require('d3');

var Lib = require('../../lib');
var rad2deg = Lib.rad2deg;
var MID_SHIFT = require('../../constants/alignment').MID_SHIFT;
var Drawing = require('../../components/drawing');
var cn = require('./constants');
var svgTextUtils = require('../../lib/svg_text_utils');

var Axes = require('../../plots/cartesian/axes');
var handleAxisDefaults = require('../../plots/cartesian/axis_defaults');
var handleAxisPositionDefaults = require('../../plots/cartesian/position_defaults');
var axisLayoutAttrs = require('../../plots/cartesian/layout_attributes');
var setConvertPolar = require('../../plots/polar/set_convert');

var anchor = {
    'left': 'start',
    'center': 'middle',
    'right': 'end'
};
var position = {
    'left': 0,
    'center': 0.5,
    'right': 1
};

module.exports = function plot(gd, cdModule, transitionOpts, makeOnCompleteCallback) {
    var fullLayout = gd._fullLayout;
    var onComplete;

    // If transition config is provided, then it is only a partial replot and traces not
    // updated are removed.
    var hasTransition = transitionOpts && transitionOpts.duration > 0;

    if(hasTransition) {
        if(makeOnCompleteCallback) {
            // If it was passed a callback to register completion, make a callback. If
            // this is created, then it must be executed on completion, otherwise the
            // pos-transition redraw will not execute:
            onComplete = makeOnCompleteCallback();
        }
    }

    Lib.makeTraceGroups(fullLayout._indicatorlayer, cdModule, 'trace').each(function(cd) {
        var plotGroup = d3.select(this);
        var cd0 = cd[0];
        var trace = cd0.trace;

        // Elements in trace
        var hasTitle = trace.title.text;
        var hasBigNumber = trace.mode.indexOf('bignumber') !== -1;
        var hasDelta = trace.mode.indexOf('delta') !== -1;
        var hasGauge = trace.mode.indexOf('gauge') !== -1;
        var isAngular = hasGauge && trace.gauge.shape === 'angular';
        var isBullet = hasGauge && trace.gauge.shape === 'bullet';

        // Domain size
        var domain = trace.domain;
        var size = Lib.extendFlat({}, fullLayout._size, {
            w: fullLayout._size.w * (domain.x[1] - domain.x[0]),
            h: fullLayout._size.h * (domain.y[1] - domain.y[0]),
            l: fullLayout._size.l + fullLayout._size.w * domain.x[0],
            r: fullLayout._size.r + fullLayout._size.w * (1 - domain.x[1]),
            t: fullLayout._size.t + fullLayout._size.h * (1 - domain.y[1]),
            b: fullLayout._size.b + fullLayout._size.h * (domain.y[0])
        });

        // title
        var titleAnchor = anchor[trace.title.align];

        // bignumber
        var fmt = d3.format(trace.valueformat);
        var bignumberSuffix = trace.number.suffix;
        if(bignumberSuffix) bignumberSuffix = ' ' + bignumberSuffix;

        // delta
        var deltaFmt = d3.format(trace.delta.valueformat);
        if(!trace._deltaLastValue) trace._deltaLastValue = 0;
        var deltaValue = function(d) {
            var value = trace.delta.showpercentage ? d.relativeDelta : d.delta;
            return value;
        };
        var deltaFormatText = function(value) {
            if(value === 0) return '-';
            return (value > 0 ? trace.delta.increasing.symbol : trace.delta.decreasing.symbol) + deltaFmt(value);
        };
        var deltaFill = function(d) {
            return d.delta >= 0 ? trace.delta.increasing.color : trace.delta.decreasing.color;
        };

        // circular gauge
        var theta = Math.PI / 2;
        var radius = Math.min(0.85 * size.w / 2, size.h * 0.65 - 20);
        var innerRadius = cn.innerRadius * radius;
        var gaugePosition = [0, 0];
        var isWide = (size.w / 2 > size.h * 0.65 - 20);
        function valueToAngle(v) {
            var angle = (v - trace.min) / (trace.max - trace.min) * Math.PI - theta;
            if(angle < -theta) return -theta;
            if(angle > theta) return theta;
            return angle;
        }

        // bullet gauge
        var bulletHeight = Math.min(cn.bulletHeight, size.h / 2);

        // Position elements
        var titleX, titleY, titleFontSize, textBaseline;
        var numbersX, numbersY, numbersMaxWidth, numbersMaxHeight;
        var bignumberFontSize;
        var bignumberAnchor = anchor[trace.number.align];
        var deltaFontSize;
        var deltaAnchor = anchor[trace.number.align];

        var centerX = size.l + size.w / 2;
        titleX = size.l + size.w * position[trace.title.align];
        textBaseline = 'central';

        numbersMaxWidth = 0.85 * size.w;
        numbersMaxHeight = size.h;
        numbersY = size.t + size.h / 2;

        if(!hasGauge) {
            // when no gauge, we are only constrained by figure size
            numbersX = size.l + position[trace.number.align] * size.w;
            bignumberFontSize = Math.min(size.w / (fmt(trace.max).length), size.h / 3);
            if(hasBigNumber) {
                deltaFontSize = 0.5 * bignumberFontSize;
            } else {
                deltaFontSize = bignumberFontSize;
            }
            titleFontSize = 0.35 * bignumberFontSize;
            titleY = size.t + Math.max(titleFontSize / 2, size.h / 5);
        } else {
            if(isAngular) {
                numbersX = centerX - 0.85 * innerRadius + 2 * 0.85 * innerRadius * position[trace.number.align];
                numbersMaxWidth = 2 * innerRadius * 0.85;
                numbersMaxHeight = innerRadius * 0.85;
                if(isWide) numbersY = size.t + size.h - (0.15 * size.h);
                gaugePosition = [centerX, numbersY];
                bignumberFontSize = Math.min(2 * innerRadius / (fmt(trace.max).length));
                numbersY -= bignumberFontSize / 2;
                deltaFontSize = 0.35 * bignumberFontSize;
                titleFontSize = 0.35 * bignumberFontSize;
                if(isWide) {
                    titleY = size.t + (0.25 / 2) * size.h - titleFontSize / 2;
                } else {
                    titleY = ((numbersY - radius) + size.t) / 2;
                }
            }
            if(isBullet) {
                var padding = cn.bulletPadding;
                var p = (1 - cn.bulletTitleSize) + padding;
                numbersMaxWidth = (cn.bulletTitleSize - padding) * size.w;
                bignumberFontSize = Math.min(0.2 * size.w / (fmt(trace.max).length), bulletHeight);
                numbersY = size.t + size.h / 2;

                titleX = size.l + (cn.bulletTitleSize - padding) * size.w * position[trace.title.align];
                numbersX = size.l + (p + (1 - p) * position[trace.number.align]) * size.w;
                deltaFontSize = 0.5 * bignumberFontSize;
                titleFontSize = 0.4 * bignumberFontSize;
                titleY = numbersY;
            }

            if(!hasBigNumber) {
                deltaFontSize = 0.75 * bignumberFontSize;
            }
        }
        var deltaDy;
        var deltaX = 0;
        if(hasDelta && hasBigNumber) {
            if(trace.delta.position === 'bottom') {
                deltaDy = (bignumberFontSize / 2 + deltaFontSize / 2);
            }
            if(trace.delta.position === 'top') {
                deltaDy = -(bignumberFontSize / 2 + deltaFontSize / 2);
                numbersY += deltaFontSize;
            }
            if(trace.delta.position === 'right') {
                deltaX = undefined; deltaDy = undefined;
            }
            if(trace.delta.position === 'left') {
                deltaX = undefined; deltaDy = undefined;
            }
        }

        plotGroup.each(function() {
            // title
            var title = d3.select(this).selectAll('text.title').data(cd);
            title.enter().append('text').classed('title', true);
            title
                .attr({
                    'text-anchor': titleAnchor,
                    'alignment-baseline': textBaseline
                })
                .text(trace.title.text)
                .call(Drawing.font, trace.title.font)
                .style('font-size', titleFontSize)
                .call(svgTextUtils.convertToTspans, gd)
                .attr('transform', function() {
                    var scaleRatio;
                    if(isBullet) {
                        scaleRatio = fitTextInside(title, (cn.bulletTitleSize - cn.bulletPadding) * size.w, size.h);
                    } else {
                        scaleRatio = fitTextInside(title, size.w, size.h);
                    }
                    return strTranslate(titleX, titleY) + ' ' + (scaleRatio < 1 ? 'scale(' + scaleRatio + ')' : '');
                });
            title.exit().remove();

            // number indicators
            var numbers = d3.select(this).selectAll('text.numbers').data(cd);
            numbers.enter().append('text').classed('numbers', true);

            var data = [];
            var numberSpec = {
                'text-anchor': bignumberAnchor,
                'alignment-baseline': textBaseline,
                class: 'number'
            };
            var deltaSpec = {
                'text-anchor': deltaAnchor,
                'alignment-baseline': textBaseline,
                class: 'delta'
            };
            if(hasBigNumber) data.push(numberSpec);
            if(hasDelta) data.push(deltaSpec);
            if(trace.delta.position === 'left') data.reverse();
            var sel = numbers.selectAll('tspan').data(data);
            sel.enter().append('tspan');
            sel
                .attr('text-anchor', function(d) {return d['text-anchor'];})
                .attr('alignment-baseline', function(d) {return d['alignment-baseline'];})
                .attr('class', function(d) { return d.class;})
                .attr('dx', function(d, i) {
                    var pos = trace.delta.position;
                    if(i === 1 && (pos === 'left' || pos === 'right')) return 10;
                    return undefined;
                });
            sel.exit().remove();

            // bignumber
            var number = numbers.select('tspan.number');
            number
                .call(Drawing.font, trace.number.font)
                .style('font-size', bignumberFontSize)
                .attr('x', undefined)
                .attr('dy', undefined);

            // delta
            var delta = numbers.select('tspan.delta');
            delta
                .call(Drawing.font, trace.delta.font)
                .style('font-size', deltaFontSize)
                .style('fill', deltaFill)
                .attr('x', deltaX)
                .attr('dy', deltaDy);

            if(hasTransition) {
                number
                    .transition()
                    .duration(transitionOpts.duration)
                    .ease(transitionOpts.easing)
                    .each('end', function() { onComplete && onComplete(); })
                    .each('interrupt', function() { onComplete && onComplete(); })
                    .attrTween('text', function() {
                        var that = d3.select(this);
                        var interpolator = d3.interpolateNumber(cd[0].lastY, cd[0].y);
                        return function(t) {
                            that.text(fmt(interpolator(t)) + bignumberSuffix);
                        };
                    });
            } else {
                number.text(fmt(cd[0].y) + bignumberSuffix);
            }

            if(hasTransition) {
                delta
                    .transition()
                    .duration(transitionOpts.duration)
                    .ease(transitionOpts.easing)
                    .each('end', function(d) { trace._deltaLastValue = deltaValue(d); onComplete && onComplete(); })
                    .each('interrupt', function() { onComplete && onComplete(); })
                    .attrTween('text', function(d) {
                        var that = d3.select(this);
                        var to = deltaValue(d);
                        var from = trace._deltaLastValue;
                        var interpolator = d3.interpolateNumber(from, to);
                        return function(t) {
                            that.text(deltaFormatText(interpolator(t)));
                        };
                    });
            } else {
                delta.text(function(d) {
                    return deltaFormatText(deltaValue(d));
                });
            }

            // Resize numbers to fit
            numbers.attr('transform', function() {
                var scaleRatio = fitTextInside(numbers, numbersMaxWidth, numbersMaxHeight);
                return strTranslate(numbersX, numbersY) + ' ' + (scaleRatio < 1 ? 'scale(' + scaleRatio + ')' : '');
            });

            // Draw circular gauge
            data = cd.filter(function() {return isAngular;});
            var gauge = d3.select(this).selectAll('g.gauge').data(data);
            gauge.enter().append('g').classed('gauge', true);
            gauge.exit().remove();
            gauge.attr('transform', strTranslate(gaugePosition[0], gaugePosition[1]));

            // Draw gauge's min and max in text
            // var minText = gauge.selectAll('text.min').data(cd);
            // minText.enter().append('text').classed('min', true);
            // minText
            //       .call(Drawing.font, trace.number.font)
            //       .style('font-size', gaugeFontSize)
            //       .attr({
            //           x: - (innerRadius + radius) / 2,
            //           y: gaugeFontSize,
            //           'text-anchor': 'middle'
            //       })
            //       .text(fmt(trace.min));
            //
            // var maxText = gauge.selectAll('text.max').data(cd);
            // maxText.enter().append('text').classed('max', true);
            // maxText
            //       .call(Drawing.font, trace.number.font)
            //       .style('font-size', gaugeFontSize)
            //       .attr({
            //           x: (innerRadius + radius) / 2,
            //           y: gaugeFontSize,
            //           'text-anchor': 'middle'
            //       })
            //       .text(fmt(trace.max));

            function arcPathGenerator(size) {
                return d3.svg.arc()
                      .innerRadius((innerRadius + radius) / 2 - size / 2 * (radius - innerRadius))
                      .outerRadius((innerRadius + radius) / 2 + size / 2 * (radius - innerRadius))
                      .startAngle(-theta);
            }

            // Draw angular axis
            var opts = trace.gauge.axis;
            var ax = mockAxis(gd, opts);
            ax.type = 'indicator';
            ax.range = [trace.min, trace.max];
            ax._id = 'angularaxis';
            ax.direction = 'clockwise';
            ax.rotation = 180;
            setConvertPolar(ax, {sector: [0, 180]}, fullLayout);
            ax.setGeometry();
            ax.setScale();

            // 't'ick to 'g'eometric radians is used all over the place here
            var t2g = function(d) { return ax.t2g(d.x); };

            var labelFns = {};
            var out = Axes.makeLabelFns(ax, 0);
            var labelStandoff = out.labelStandoff;

            labelFns.xFn = function(d) {
                var rad = t2g(d);
                return Math.cos(rad) * labelStandoff;
            };

            labelFns.yFn = function(d) {
                var rad = t2g(d);
                var ff = Math.sin(rad) > 0 ? 0.2 : 1;
                return -Math.sin(rad) * (labelStandoff + d.fontSize * ff) +
                    Math.abs(Math.cos(rad)) * (d.fontSize * MID_SHIFT);
            };

            labelFns.anchorFn = function(d) {
                var rad = t2g(d);
                var cos = Math.cos(rad);
                return Math.abs(cos) < 0.1 ?
                    'middle' :
                    (cos > 0 ? 'start' : 'end');
            };

            labelFns.heightFn = function(d, a, h) {
                var rad = t2g(d);
                return -0.5 * (1 + Math.sin(rad)) * h;
            };

            var shift;
            var _transFn = function(rad) {
                return strTranslate(gaugePosition[0] + radius * Math.cos(rad), gaugePosition[1] - radius * Math.sin(rad));
            };
            var transFn = function(d) {
                return _transFn(t2g(d));
            };
            var transFn2 = function(d) {
                var rad = t2g(d);
                return _transFn(rad) + strRotate(-rad2deg(rad));
            };

            var axLayer = d3.select(this).selectAll('g.angularaxis').data(data);
            axLayer.enter().append('g')
              .classed('angularaxis', true)
              .classed('crisp', true);
            axLayer.exit().remove();
            axLayer.selectAll('g.' + ax._id + 'tick,path').remove();

            var vals = Axes.calcTicks(ax);
            var tickSign;

            if(ax.visible) {
                tickSign = ax.ticks === 'inside' ? -1 : 1;
                var pad = (ax.linewidth || 1) / 2;

                Axes.drawTicks(gd, ax, {
                    vals: vals,
                    layer: axLayer,
                    path: 'M' + (tickSign * pad) + ',0h' + (tickSign * ax.ticklen),
                    transFn: transFn2,
                    crips: true
                });

                Axes.drawLabels(gd, ax, {
                    vals: vals,
                    layer: axLayer,
                    transFn: transFn,
                    labelFns: labelFns
                });
            }

            // Reexpress our background attributes for drawing
            var gaugeBg = {
                range: [trace.min, trace.max],
                color: trace.gauge.bgcolor,
                line: {
                    color: trace.gauge.bordercolor,
                    width: 0
                },
                height: 1
            };

            var gaugeOutline = {
                range: [trace.min, trace.max],
                color: 'rgba(0, 0, 0, 0)',
                line: {
                    color: trace.gauge.bordercolor,
                    width: trace.gauge.borderwidth
                },
                height: 1
            };

            // Reexpress threshold for drawing
            var v = trace.gauge.threshold.value;
            var thresholdArc = {
                range: [v, v],
                color: trace.gauge.threshold.color,
                line: {
                    color: trace.gauge.threshold.color,
                    width: trace.gauge.threshold.width
                },
                height: trace.gauge.threshold.height
            };

            function drawArc(p) {
                p
                    .attr('d', function(d) {
                        return arcPathGenerator(d.height)
                          .startAngle(valueToAngle(d.range[0]))
                          .endAngle(valueToAngle(d.range[1]))();
                    });
            }

            function styleArc(p) {
                p
                    .style('fill', function(d) { return d.color;})
                    .style('stroke', function(d) { return d.line.color;})
                    .style('stroke-width', function(d) { return d.line.width;});
            }

            // Draw background + steps
            var arcs = [gaugeBg].concat(trace.gauge.steps);
            if(v) arcs.push(thresholdArc);
            var targetArc = gauge.selectAll('g.targetArc').data(arcs);
            targetArc.enter().append('g').classed('targetArc', true).append('path');
            targetArc.select('path').call(drawArc).call(styleArc);
            targetArc.exit().remove();

            // Draw foreground with transition
            var valueArcPath = arcPathGenerator(trace.gauge.value.height);
            var fgArc = gauge.selectAll('g.fgArc').data([trace.gauge.value]);
            fgArc.enter().append('g').classed('fgArc', true).append('path');

            var fgArcPath = fgArc.select('path');
            if(hasTransition) {
                fgArcPath
                      .transition()
                      .duration(transitionOpts.duration)
                      .ease(transitionOpts.easing)
                      .each('end', function() { onComplete && onComplete(); })
                      .each('interrupt', function() { onComplete && onComplete(); })
                      .attrTween('d', arcTween(valueArcPath, valueToAngle(cd[0].lastY), valueToAngle(cd[0].y)));
            } else {
                fgArcPath
                      .attr('d', valueArcPath.endAngle(valueToAngle(cd[0].y)));
            }
            fgArcPath.call(styleArc);
            fgArc.exit().remove();

            var gaugeBorder = gauge.selectAll('g.gaugeOutline').data([gaugeOutline]);
            gaugeBorder.enter().append('g').classed('gaugeOutline', true).append('path');
            gaugeBorder.select('path').call(drawArc).call(styleArc);
            gaugeBorder.exit().remove();

            // Draw bullet
            var bulletLeft = hasTitle ? cn.bulletTitleSize : 0;
            var bulletRight = (hasBigNumber || hasDelta) ? (1 - cn.bulletTitleSize) : 1.0;

            data = cd.filter(function() {return isBullet;});
            var innerBulletHeight = trace.gauge.value.height * bulletHeight;
            var bulletVerticalMargin = numbersY - bulletHeight / 2;
            var bullet = d3.select(this).selectAll('g.bullet').data(data);
            bullet.enter().append('g').classed('bullet', true);
            bullet.exit().remove();
            bullet.attr('transform', 'translate(' + (size.l + (bulletLeft * size.w)) + ',' + bulletVerticalMargin + ')');

            // Draw cartesian axis
            // force full redraw of labels and ticks
            var range = [trace.min, trace.max];
            ax = mockAxis(gd, opts, range);
            ax.position = 0;
            ax.domain = [bulletLeft, bulletRight];
            ax.setScale();

            // var g = d3.select(this);
            // var axLayer = Lib.ensureSingle(g, 'g', 'gaugeaxis', function(s) { s.classed('crisp', true); });
            axLayer = d3.select(this).selectAll('g.bulletaxis').data(data);
            axLayer.enter().append('g')
              .classed('bulletaxis', true)
              .classed('crisp', true);
            axLayer.selectAll('g.' + ax._id + 'tick,path').remove();
            axLayer.exit().remove();

            shift = bulletHeight + bulletVerticalMargin;

            vals = Axes.calcTicks(ax);
            transFn = Axes.makeTransFn(ax);
            tickSign = Axes.getTickSigns(ax)[2];

            if(ax.visible) {
                Axes.drawTicks(gd, ax, {
                    vals: ax.ticks === 'inside' ? Axes.clipEnds(ax, vals) : vals,
                    layer: axLayer,
                    path: Axes.makeTickPath(ax, shift, tickSign),
                    transFn: transFn
                });

                Axes.drawLabels(gd, ax, {
                    vals: vals,
                    layer: axLayer,
                    transFn: transFn,
                    labelFns: Axes.makeLabelFns(ax, shift)
                });
            }

            // Draw bullet background and steps
            var targetBullet = bullet.selectAll('g.targetBullet').data([gaugeBg].concat(trace.gauge.steps));
            targetBullet.enter().append('g').classed('targetBullet', true).append('rect');
            targetBullet.select('rect')
                  .attr('width', function(d) { return Math.max(0, ax.c2p(d.range[1] - d.range[0]));})
                  .attr('x', function(d) { return ax.c2p(d.range[0]);})
                  .attr('height', bulletHeight)
                  .style('fill', function(d) { return d.color;})
                  .style('stroke', function(d) { return d.line.color;})
                  .style('stroke-width', function(d) { return d.line.width;});
            targetBullet.exit().remove();

            // Draw value bar with transitions
            var fgBullet = bullet.selectAll('g.fgBullet').data(cd);
            fgBullet.enter().append('g').classed('fgBullet', true).append('rect');
            fgBullet.select('rect')
                  .attr('height', innerBulletHeight)
                  .attr('y', (bulletHeight - innerBulletHeight) / 2)
                  .style('fill', trace.gauge.value.color)
                  .style('stroke', trace.gauge.value.line.color)
                  .style('stroke-width', trace.gauge.value.line.width);
            if(hasTransition) {
                fgBullet.select('rect')
                  .transition()
                  .duration(transitionOpts.duration)
                  .ease(transitionOpts.easing)
                  .each('end', function() { onComplete && onComplete(); })
                  .each('interrupt', function() { onComplete && onComplete(); })
                  .attr('width', Math.max(0, ax.c2p(Math.min(trace.max, cd[0].y))));
            } else {
                fgBullet.select('rect')
                  .attr('width', Math.max(0, ax.c2p(Math.min(trace.max, cd[0].y))));
            }
            fgBullet.exit().remove();

            data = cd.filter(function() {return trace.gauge.threshold.value;});
            var threshold = bullet.selectAll('g.threshold').data(data);
            threshold.enter().append('g').classed('threshold', true).append('line');
            threshold.select('line')
                .attr('x1', ax.c2p(trace.gauge.threshold.value))
                .attr('x2', ax.c2p(trace.gauge.threshold.value))
                .attr('y1', (1 - trace.gauge.threshold.height) / 2 * bulletHeight)
                .attr('y2', (1 - (1 - trace.gauge.threshold.height) / 2) * bulletHeight)
                .style('stroke', trace.gauge.threshold.color)
                .style('stroke-width', trace.gauge.threshold.width);
            threshold.exit().remove();

            var bulletOutline = bullet.selectAll('g.bulletOutline').data([gaugeOutline]);
            bulletOutline.enter().append('g').classed('bulletOutline', true).append('rect');
            bulletOutline.select('rect')
                  .attr('width', function(d) { return Math.max(0, ax.c2p(d.range[1] - d.range[0]));})
                  .attr('x', function(d) { return ax.c2p(d.range[0]);})
                  .attr('height', bulletHeight)
                  .style('fill', function(d) { return d.color;})
                  .style('stroke', function(d) { return d.line.color;})
                  .style('stroke-width', function(d) { return d.line.width;});
            bulletOutline.exit().remove();
        });
    });
};

// Returns a tween for a transition’s "d" attribute, transitioning any selected
// arcs from their current angle to the specified new angle.
function arcTween(arc, endAngle, newAngle) {
    return function() {
        var interpolate = d3.interpolate(endAngle, newAngle);
        return function(t) {
            return arc.endAngle(interpolate(t))();
        };
    };
}

// mocks our axis
function mockAxis(gd, opts, zrange) {
    var fullLayout = gd._fullLayout;

    var axisIn = {
        type: 'linear',
        ticks: 'outside',
        range: zrange,
        tickmode: opts.tickmode,
        nticks: opts.nticks,
        tick0: opts.tick0,
        dtick: opts.dtick,
        tickvals: opts.tickvals,
        ticktext: opts.ticktext,
        ticklen: opts.ticklen,
        tickwidth: opts.tickwidth,
        tickcolor: opts.tickcolor,
        showticklabels: opts.showticklabels,
        tickfont: opts.tickfont,
        tickangle: opts.tickangle,
        tickformat: opts.tickformat,
        exponentformat: opts.exponentformat,
        separatethousands: opts.separatethousands,
        showexponent: opts.showexponent,
        showtickprefix: opts.showtickprefix,
        tickprefix: opts.tickprefix,
        showticksuffix: opts.showticksuffix,
        ticksuffix: opts.ticksuffix,
        title: opts.title,
        showline: true,
        anchor: 'free',
        position: 1
    };

    var axisOut = {
        type: 'linear',
        _id: 'x' + opts._id
    };

    var axisOptions = {
        letter: 'x',
        font: fullLayout.font,
        noHover: true,
        noTickson: true
    };

    function coerce(attr, dflt) {
        return Lib.coerce(axisIn, axisOut, axisLayoutAttrs, attr, dflt);
    }

    handleAxisDefaults(axisIn, axisOut, coerce, axisOptions, fullLayout);
    handleAxisPositionDefaults(axisIn, axisOut, coerce, axisOptions);

    return axisOut;
}

function strTranslate(x, y) {
    return 'translate(' + x + ',' + y + ')';
}

function strRotate(angle) {
    return 'rotate(' + angle + ')';
}

function fitTextInside(el, width, height) {
    // compute scaling ratio to have text fit within specified width and height
    var textBB = Drawing.bBox(el.node());
    var ratio = Math.min(width / textBB.width, height / textBB.height);
    return ratio;
}
