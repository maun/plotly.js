/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Lib = require('../../lib');
var attributes = require('./attributes');
var handleDomainDefaults = require('../../plots/domain').defaults;
var Template = require('../../plot_api/plot_template');
var handleArrayContainerDefaults = require('../../plots/array_container_defaults');
var cn = require('./constants.js');

var handleTickValueDefaults = require('../../plots/cartesian/tick_value_defaults');
var handleTickMarkDefaults = require('../../plots/cartesian/tick_mark_defaults');
var handleTickLabelDefaults = require('../../plots/cartesian/tick_label_defaults');

function supplyDefaults(traceIn, traceOut, defaultColor, layout) {
    function coerce(attr, dflt) {
        return Lib.coerce(traceIn, traceOut, attributes, attr, dflt);
    }

    coerce('mode');
    coerce('value');
    coerce('valueformat');
    coerce('min');
    coerce('max', 1.5 * traceOut.value);

    handleDomainDefaults(traceOut, layout, coerce);

    // Number attributes
    coerce('number.font.color', layout.font.color);
    coerce('number.font.family', layout.font.family);
    coerce('number.align');
    coerce('number.suffix');

    // Title attributes
    coerce('title.font.color', traceOut.number.font.color);
    coerce('title.font.family', traceOut.number.font.family);
    coerce('title.text');
    // Lib.coerceFont(coerce, 'font', layout.font);

    // gauge attributes
    var gaugeIn = traceIn.gauge;
    var gaugeOut = Template.newContainer(traceOut, 'gauge');
    function coerceGauge(attr, dflt) {
        return Lib.coerce(gaugeIn, gaugeOut, attributes.gauge, attr, dflt);
    }
    coerceGauge('shape');

    // gauge background
    coerceGauge('bgcolor');
    coerceGauge('borderwidth');
    coerceGauge('bordercolor');

    // gauge value indicator
    coerceGauge('value.color');
    coerceGauge('value.line.color');
    coerceGauge('value.line.width');
    var defaultValueSize = cn.valueHeight * (traceOut.gauge.shape === 'bullet' ? 0.5 : 1);
    coerceGauge('value.size', defaultValueSize);

    // Gauge steps
    if(gaugeIn && gaugeIn.steps) {
        handleArrayContainerDefaults(gaugeIn, gaugeOut, {
            name: 'steps',
            handleItemDefaults: stepDefaults
        });
    } else {
        gaugeOut.steps = [];
    }

    // Gauge threshold
    coerceGauge('threshold.value');
    coerceGauge('threshold.size');
    coerceGauge('threshold.width');
    coerceGauge('threshold.color');

    // Gauge axis
    var axisIn = {};
    if(gaugeIn) axisIn = gaugeIn.axis || {};
    var axisOut = Template.newContainer(gaugeOut, 'axis');
    function coerceGaugeAxis(attr, dflt) {
        return Lib.coerce(axisIn, axisOut, attributes.gauge.axis, attr, dflt);
    }
    handleTickValueDefaults(axisIn, axisOut, coerceGaugeAxis, 'linear');

    var opts = {outerTicks: false, font: layout.font};
    handleTickLabelDefaults(axisIn, axisOut, coerceGaugeAxis, 'linear', opts);
    handleTickMarkDefaults(axisIn, axisOut, coerceGaugeAxis, 'linear', opts);

    // delta attributes
    coerce('delta.font.color', traceOut.number.font.color);
    coerce('delta.font.family', traceOut.number.font.family);
    coerce('delta.reference', traceOut.value);
    coerce('delta.showpercentage');
    coerce('delta.valueformat', traceOut.delta.showpercentage ? '2%' : traceOut.valueformat);
    coerce('delta.increasing.symbol');
    coerce('delta.increasing.color');
    coerce('delta.decreasing.symbol');
    coerce('delta.decreasing.color');
    coerce('delta.position');
}

function stepDefaults(valueIn, valueOut) {
    function coerce(attr, dflt) {
        return Lib.coerce(valueIn, valueOut, attributes.gauge.steps, attr, dflt);
    }

    coerce('color');
    coerce('line.color');
    coerce('line.width');
    coerce('range');
    coerce('size');
}

module.exports = {
    supplyDefaults: supplyDefaults
};
