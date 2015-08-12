'use strict';

var fetchres = require('fetchres');
var api = require('next-ft-api-client');
var cacheControl = require('../../utils/cache-control');
var excludePrimaryTheme = require('../../utils/exclude-primary-theme');

module.exports = function(req, res, next) {
	if (!res.locals.flags.articleRelatedContent) {
		return res.status(404).end();
	}

	api.contentLegacy({
		uuid: req.params.id,
		useElasticSearch: res.locals.flags.elasticSearchItemGet
	})
		.then(function (article) {
			res.set(cacheControl);
			var metadata = article && article.item && article.item.metadata;
			var topics = metadata && metadata.topics.filter(excludePrimaryTheme(article));

			if (!topics || !topics.length) {
				throw new Error('No related');
			}

			res.render('related/topics', {
				topics: topics.map(function (topic, index) {
					topic = topic.term;
					var model = {
						name: topic.name,
						url: '/stream/topicsId/' + topic.id,
						conceptId: topic.id,
						taxonomy: 'topics'
					};

					return model;
				})
			});
		})
		.catch(function (err) {
			if (err.message === 'No related') {
				res.status(200).end();
			} else if (err instanceof fetchres.ReadTimeoutError) {
				res.status(500).end();
			} else if (fetchres.originatedError(err)) {
				res.status(404).end();
			} else {
				next(err);
			}
		});
};
