"use strict";

var util = require('util');
var child_process = require('child_process');


function slice(args, begin, end) {
    return Array.prototype.slice.call(args, begin, end);
}


function _getID(o, where) {
    var id,
        count = 0;
    for (id in where) {
        if (where[id] === o) {
            return id;
        }
        count++;
    }
    return "n" + count;
}

function _explore(o, res) {
    var edges  = res.edges,
        nodes  = res.nodes,
        thisID = _getID(o, nodes),
        other,
        otherID,
        e;
    if (!(thisID in nodes)) {
        nodes[thisID] = o;
        for (e in edges) {
            try {
                other = edges[e].access(o);
                otherID = _explore(other, res);
                edges[e][thisID] = otherID;
            } catch (Error) {

            }
        }
    }
    return thisID;
}

function error(err) {
    err = err || Error;
    throw err.call(Object.create(err.prototype));
}

function explore(o) {
    var res = {
        nodes: {},
        edges: {
            "[[Prototype]]": Object.create(Object.prototype, {
                access: { value: x => Object.getPrototypeOf(x) }
            }),
            ".prototype": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("prototype") ? x.prototype : error() }
            }),
            ".constructor": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("constructor") ? x.constructor : error() }
            }),
            ".valueOf()": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("valueOf") ? x.valueOf() : error() }
                //access: { value: x => (typeof x.valueOf === "function") ? x.valueOf() : error() }
            }),
            ".name": Object.create(Object.prototype, {
                access: { value: x => x.hasOwnProperty("name") ? x.name : error() }
            }),
        }
    };
    _explore(o, res);
    return res;
}




const DotGraph = (function () {

    function DotNode(options) {
        this.attrs = options || {};
        ['id', 'rank', 'represents'].forEach(k => {
            if (options.hasOwnProperty(k)) {
                this[k] = options[k];
                delete options[k];
            }
        });
        ['invis'].forEach(k => {    // boolean options to go into attrs.style
            if (options.hasOwnProperty(k)) {
                options.style = k;
                delete options[k];
            }
        });
        return this;
    };
    DotNode.prototype.def = function () {
        var attrStr = Object.keys(this.attrs).map(a =>
            a + '='
            + (a === 'label'
                ? '"' + this.attrs[a].split('\\N').map(JSON.stringify).map(s => s.substr(1, s.length-2)).join('\\N') + '"'
                : this.attrs[a]
            )
        );
        return this.id + '[' + attrStr.join(',') + '];';
    };
    DotNode.prototype.toString = function () {
        return this.id;
    };

    const DotRank = (function () {
        var ctor = function (graph) {
            this.graph = graph;
            this.index = graph.ranks.length;
            this.dummyNode = new DotNode({ id: "_dummy" + this.index, rank: this, invis: true });
            this.nodes = [];
            return this;
        };
        ctor.prototype.toString = function () {
            var indent1 = '    ';
            var indent2 = indent1 + '    ';
            var res = indent1 + '{ rank=';
            if (this.index === 0) {
                res += 'min';
            } else if (this.index === this.graph.ranks.length - 1) {
                res += 'max';
            } else {
                res += 'same';
            }
            res += '; ' + this.dummyNode.def() + '\n';
            res += this.nodes.map(n => indent2 + n.def()).join('\n');
            res += '\n' + indent1 + '}\n';
            return res;
        };
        ctor.prototype.addNode = function (dotNode) {
            this.nodes.push(dotNode);
            return dotNode;
        };
        return ctor;
    }());

    function DotGraph(options) {
        var attr,
            accessor;
        options = options || {};
        this.ranks = [];
        this.nodesInNoRank = [];
        this.edges = [];
        this.attributes = Object.create(this.attributes);   // inherit from default attributes
        for (var attr in options || {}) {
            var accessor = this[attr];
            if (util.isFunction(accessor)) {
                accessor.call(this, options[attr]);
            } else {
                throw new Error("invalid graph attribute " + attr);
            }
        }
        return this;
    };

    DotGraph.prototype.attributes = {
        label:    null,
        fontname: "Arial",
        fontsize: 18,
        labelloc: "t",  // top
        compound: true, // allow edges between clusters
    };
    Object.keys(DotGraph.prototype.attributes).forEach(graphAttr => {
        DotGraph.prototype[graphAttr] = function (attrValue) {
            if (arguments.length === 0) {
                return this.attributes[graphAttr];
            } else {
                this.attributes[graphAttr] = attrValue;
                return this;
            }
        };
        DotGraph[graphAttr] = function (attrValue) {
            if (arguments.length === 0) {
                throw new TypeError("missing argument for static method DotGraph." + graphAttr);
            }
            return new DotGraph()[graphAttr](attrValue);
        };
    });

    DotGraph.prototype.rank = function (i) {
        var n = this.ranks.length;
        while (n <= i) {
            this.ranks.push(new DotRank(this));
            n++;
        }
        return this.ranks[i];
    };

    DotGraph.prototype.addNode = function (nodespec) {
        var node,
            rank = null;
        nodespec = nodespec || {};
        if (nodespec.rank) {
            rank = nodespec.rank;
            delete nodespec.rank;
        }
        node = new DotNode(nodespec);
        if (rank === null) {
            this.nodesInNoRank.push(node);
        } else {
            this.rank(rank).addNode(node);
        }
        return node;
    };

    DotGraph.prototype.addPath = function () {
        var args = slice(arguments),
            n    = args.length,
            i,
            edges = [];
        for (i = 0; i < n - 1; i++) {
            edges.push({ from: args[i], to: args[i+1], attributes: {} });
        }
        edges.forEach(e => this.edges.push(e));
        var where = {
            where: edgeOptions => {
                edges.forEach(e => Object.assign(e.attributes, edgeOptions));
                return where;
            },
        };
        return where;
    };

    DotGraph.prototype.toString = function () {
        var res    = '',
            indent = '    ',
            attr;
        res += 'digraph ' + (this.label() ? JSON.stringify(this.label()) + ' ' : '') + '{\n';
        for (attr in this.attributes) { // including defaults from this.attributes.prototype
            res += indent + attr + '=' + JSON.stringify(this.attributes[attr]) + ';\n';
        }
        res += '\n';
        res += indent + 'node[fontname=Arial,fontsize=12];\n\n';

        res += this.ranks.join('');
        res += indent + this.ranks.map(r => r.dummyNode.id).join('->') + '[style=invis];\n\n';

        res += this.edges.map(
            e => indent + e.from.id + '->' + e.to.id
                 + '[' + Object.keys(e.attributes).map(a => a + '=' + JSON.stringify(e.attributes[a])).join(',') + ']'
                 + ';\n'
        ).join('');

        res += '\n}\n';
        return res;
    };

    DotGraph.prototype.render = function (opts) {
        var dotInput,
            dot     = 'dot.exe',
            dotArgs,
            outFile;
        opts = opts || {};
        if (!opts.format) {
            opts.format = "svg";
        }
        if (!opts.output) {
            opts.output = "../test";
        }
        outFile = opts.output + "." + opts.format;
        dotArgs = [
            "-T" + opts.format,
            "-o" + outFile,
        ];

        dotInput = this.toString();
        console.log(dotInput);
        var child = child_process.execFileSync('dot.exe', dotArgs, {
            //cwd: ,
            input: dotInput,
        });
        if (opts.show) {
            child_process.execFile('c:\\Programme\\Google\\Chrome\\Application\\chrome.exe', [outFile]);
        }
        return this;
    };


    return DotGraph;
}());





function toDot(x) {
    const colors = [
        "black",
        "green",
        "blue",
        "red",
        "pink",
    ];
    var res = "digraph {",
        n, o, i, c, e,
        ranks = [],
        attrs, label;
    for (n in x.nodes) {
        o = x.nodes[n];
        attrs = '';
        switch (typeof o) {
            case "function":
                attrs = 'label="function\\n' + o.name + '"'
                      + ',fontname="Arial"'
                      + ',name=' + JSON.stringify(util.inspect(o))
                ;
                break;
            case "object":
                attrs = 'label="' + (o === null ? "null" : "object") + '"'
                ;
                break;
            case "string":
                attrs = 'label="string\\n' + JSON.stringify(JSON.stringify(o)).substr(1)
                ;
                break;
            default:
                attrs = 'label="' + (typeof o) + "\\n" + util.inspect(o) + '"'
                ;
        }
        /*
        if (o !== null && o !== undefined) {
            Object.keys(o).forEach(e => {
                label += "\\n." + e + ": "; // + util.inspect(o[e]);
            });
        }
        */
        res += '\n    ' + n + '[' + attrs + '];';
    }
    res += "\n";
    i = 0;
    for (n in x.edges) {
        if (n !== ".constructor") {
            c = colors[i % colors.length];
            i++;
            label = '[label="' + n + '"]';
            res += "\n    "
                + "/* " + n + " */"
                + "\n    edge[color=" + c + ",fontcolor=" + c
                + (n === "[[Prototype]]" ? ",weight=10,style=bold" : ",weight=1,style=solid")
                + "];";
            for (e in x.edges[n]) {
                res += "\n    " + e + "->" + x.edges[n][e] + label + ";";
                label = "";
            }
            res += "\n";
        }
    }
    res += "\n}";
    return res;
}


function runDot(x) {
    var args = [
            "-Tsvg",
            "-otest.svg"
        ],
        input = toDot(x);
    console.log(x);
    console.log(input);
    var child = child_process.execFileSync('dot.exe', args, {
        //cwd: ,
        input: input,
    });
}


module.exports = DotGraph;

