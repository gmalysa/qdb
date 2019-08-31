/**
 * Export some useful functions for our dust rendering
 * Load it in the server and pass to the relevant dust initializers in common.init
 */

var _ = require('underscore');
var dust = require('dustjs-linkedin');

/**
 * Filtering function to use with dustjs that will apply syntax highlighting to values
 * that are expected to hold quotes
 * @param quote to syntax highlight
 * @return html string with useful bits of quote highlighting applied
 */
module.exports.dust_quotify = function(value) {
	// Create regex to parse a line
	var tsmatch = '^(\\[\\d+:\\d+(?::\\d+)*\\])?';
	var nickmatch = ' ?(?:(?:(?:<(\\S+)>|(\\S+):)|(?:\\*{1,3} ?(\\S+)))|(?:\\*{3} ?(\\S+)))';
	var restmatch = ' ?([\\w\\W]+)$';
	var urlmatch = /(https?:\/\/)((?:\S+(?:\.|\/)){2,}(?:\S+(?:\.|\/)?))/g;
	var regex = new RegExp(tsmatch+nickmatch+restmatch);

	var lines = value.split('\n');
	var names = [];
	var clist = {};

	if (!(lines instanceof Array))
		lines = [lines];

	lines = _.map(lines, function(v) {
		var matches = v.match(regex);
		
		if (matches == null)
			return v;

		var rtn = '';
		var name = matches[2];
		var mname = '';
		var action = false;
		var join = false;
		var cl = 's1';
		
		if (matches[3])
			name = matches[3];
		else if (matches[4]) {
			name = matches[4];
			action = true;
		}
		else if (matches[5]) {
			name = matches[5];
			join = true;
		}

		mname = name;
		if (name.match(/^\.|@|%|&|\+/))
			mname = name.substr(1);

		if (_.contains(names, mname)) {
			cl = clist[mname];
		}
		else {
			names.push(mname);
			cl = 's'+names.length;
			clist[mname] = cl;
		}
	
		var content = matches[6].replace('<', '&lt;').replace('>', '&gt;').replace(urlmatch, '<a href="$1$2">$1$2</a>');

		if (matches[1])
			rtn = '<span class="timestamp">'+matches[1]+'</span> ';
		
		if (action)
			rtn = rtn+'<span class="action">* <span class="'+cl+'">'+name+'</span> '+content+'</span>';
		else if (join) {
			rtn = rtn+'<span class="join">*** <span class="'+cl+'">'+name+'</span> '+content+'</span>';
		}
		else {
			rtn = rtn+'<span class="'+cl+'">&lt;'+name+'&gt;</span> ';
			rtn = rtn+content;
		}

		return rtn;
	});

	return lines.join('\n');
}

/**
 * Filtering function to replace . with _, for converting IPs to use as IDs in html elements
 * @param value The value to do the replacement on
 */
module.exports.dust_dot2underscore = function(value) {
	return (value+'').replace(/\./g, '_');
}

/**
 * Dust helper that creates a pagination list, a somewhat complicated operation
 * apparently
 * @param base_url The base url for links, should be attached with _.partial
 * @param chunk The current dust chunk
 * @param ctx The current dust context
 * @param bodies The current dust bodies
 * @param params Parameters to the dust helper specified in the template
 * @return Chunk with our rendering added to it
 */
module.exports.dust_paginate = function(base_url, chunk, ctx, bodies, params) {
	var url = base_url + dust.helpers.tap(params.url, chunk, ctx);
	var count = parseInt(dust.helpers.tap(params.count, chunk, ctx));
	var page = parseInt(dust.helpers.tap(params.page, chunk, ctx));
	var maxPage = 1;

	if (count > 0)
		maxPage = Math.ceil(count/50);
	
	var sMin = Math.max(page - 2, 1);
	var sMax = Math.min(page + 2, maxPage);

	var def_props = {url : url, isLink : false, isActive : false, isEllipsis : false};
	var adddef = function(obj) { return _.defaults(obj, def_props); };

	if (page != 1) {
		chunk = chunk.render(bodies.block, ctx.push(adddef({page : page-1, text : 'prev', isLink : true})));
	}

	if (sMin > 1) {
		chunk = chunk.render(bodies.block, ctx.push(adddef({page : 1, isLink : true})));
		if (sMin > 2) {
			chunk = chunk.render(bodies.block, ctx.push(adddef({isEllipsis : true})));
		}
	}

	for (var i = sMin; i < page; ++i) {
		chunk = chunk.render(bodies.block, ctx.push(_.defaults({page : i, isLink : true}, def_props)));
	}

	chunk = chunk.render(bodies.block, ctx.push(_.defaults({page : page, isActive : true}, def_props)));

	for (var i = page+1; i <= sMax; ++i) {
		chunk = chunk.render(bodies.block, ctx.push(_.defaults({page : i, isLink : true}, def_props)));
	}

	if (sMax < maxPage) {
		if (sMax < maxPage - 1) {
			chunk = chunk.render(bodies.block, ctx.push(_.defaults({isEllipsis : true}, def_props)));
		}
		chunk = chunk.render(bodies.block, ctx.push(_.defaults({page : maxPage, isLink : true}, def_props)));
	}

	if (page != maxPage) {
		chunk = chunk.render(bodies.block, ctx.push(adddef({page : page+1, text : 'next', isLink : true})));
	}

	return chunk;
}

/**
 * Dust helper used inside a paginate block that will help render each of the subtypes
 * based on different rules
 * @param test Name of the field to test for
 * @param chunk The currently being rendered chunk
 * @param ctx The current context for variables
 * @param bodies The body for this helper
 * @return Chunk after rendering the helper
 */
module.exports.dust_paginate_body = function(test, chunk, ctx, bodies) {
	if (ctx.get(test)) {
		if (bodies.block)
			return chunk.render(bodies.block, ctx);
		else {
			return chunk;
		}
	}
	return chunk;
}

/**
 * Dust helper used to display the correct voting image
 */
module.exports.dust_vote_check = function(base_url, chunk, ctx, bodies, params) {
	var target = parseInt(dust.helpers.tap(params.target, chunk, ctx));
	var url = base_url + dust.helpers.tap(params.url_frag, chunk, ctx);
	var value = parseInt(ctx.get('vote'));

	if (target == value)
		return chunk.write(url + '_voted' + '.png');
	return chunk.write(url + '.png');
};
