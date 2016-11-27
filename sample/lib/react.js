var ReactDOMServer = require('react-dom/server');
var React = require('react');
import {Greeting} from './react-component';


console.log(
    ReactDOMServer.renderToString(<Greeting name="Splittable in React" />));
