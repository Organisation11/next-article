'use strict';

var api = require('next-ft-api-client');
var fetchres = require('fetchres');
require('array.prototype.find');
var accessMetadata = [
	{
		path_regex: 'cms/s/[01]',
		classification: 'conditional_standard'
	},
	{
		path_regex: 'cms/s/2',
		classification: 'unconditional'
	},
	{
		path_regex: 'cms/s/3',
		classification: 'conditional_premium'
	},
	{
		path_regex: 'fastft',
		classification: 'conditional_standard'

	}
]

function suppressBadResponses(err) {
	if (fetchres.originatedError(err)) {
		return;
	} else {
		throw err;
	}
}

module.exports = function(req, res, next) {
	if (req.get('X-FT-Access-Metadata') === 'remote_headers') {
		Promise.all([
			api.contentLegacy({
					uuid: req.params.id,
					useElasticSearch: res.locals.flags.elasticSearchItemGet
				})
				.catch(suppressBadResponses),
			api.content({
					uuid: req.params.id,
					useElasticSearch: res.locals.flags.elasticSearchItemGet
				})
				.catch(suppressBadResponses),
			fetch('http://blogs.ft.com/__access_metadata')
				.then(function (response) {
					if (!response.ok) {
						return {};
					}
					return response.json();
				})
		])
			.then(function(results) {
				var articleLegacy = results[0];
				var article = results[1];
				var classification = 'conditional_registered';
				var url = articleLegacy ? articleLegacy.item.location.uri : article.webUrl;
				var access = accessMetadata.find(function (access) {
					return url.search(access.path_regex);
				});
				if (access) {
					classification = access.classification;
				}

				res.set('Outbound-Cache-Control', 'public, max-age=3600');
				res.set('Surrogate-Control', 'max-age=3600');
				res.vary('X-FT-UID');
				res.set('X-FT-UID', req.params.id);
				res.set('X-FT-Content-Classification', classification);
				res.status(200).end();
			})
			.catch(next);
	} else {
		next();
	}
};
