var ReactDOMServer = require('react-dom/server');
var React = require('react');
import {Greeting} from './react-component';

console.log(
    ReactDOMServer.renderToString(<Greeting name="Splittable in React" />));

// Currently bundle root modules must have at least one export.
export function anything() {}