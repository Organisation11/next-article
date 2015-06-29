'use strict';

var fetchres = require('fetchres');
var api = require('next-ft-api-client');
var cacheControl = require('../../utils/cache-control');
var extractUuid = require('../../utils/extract-uuid');
var excludePrimaryTheme = require('../../utils/exclude-primary-theme');

module.exports = function(req, res, next) {
	if (!res.locals.flags.articleRelatedContent) {
		return res.status(404).end();
	}

	if (res.locals.flags.mentionsV2) {
		api.content({
			uuid: req.params.id,
			type: 'Article',
			metadata: true,
			useElasticSearch: res.locals.flags.elasticSearchItemGet
		})
			.then(function (article) {
				res.set(cacheControl);
				var orgPromises = article.annotations
					.filter(function (annotation) {
						return annotation.predicate === 'http://www.ft.com/ontology/annotation/mentions' &&
							annotation.type === 'ORGANISATION';
					})
					.map(function (organisation) {
						return api.organisations({
								uuid: extractUuid(organisation.uri)
							})
							.catch(function(err) {
								return null;
							});
					});
				if (!orgPromises.length) {
					throw new Error('No related');
				}
				return Promise.all(orgPromises);
			})
			.then(function (results) {
				var organisations = results
					.filter(function (organisation) {
						return organisation;
					})
					.map(function (organisation) {
						return {
							name: organisation && (organisation.prefLabel || (organisation.labels && organisation.labels[0])),
							url: '/organisations/' + extractUuid(organisation.id)
						};
					});
				if (!organisations.length) {
					throw new Error('No related');
				}
				res.render('related/organisations', {
					organisations: organisations
				});
			})
			.catch(function (err) {
				if (err.message === 'No related') {
					res.status(200).end();
				} else if (err instanceof fetchres.ReadTimeoutError) {
					res.status(500).end();
				} else if (err instanceof fetchres.BadServerResponseError) {
					res.status(404).end();
				} else {
					next(err);
				}
			});
	} else {
		api.contentLegacy({
			uuid: req.params.id,
			useElasticSearch: res.locals.flags.elasticSearchItemGet
		})
			.then(function (article) {
				res.set(cacheControl);
				var relations = article.item.metadata.organisations.filter(excludePrimaryTheme(article));
				if (!relations.length) {
					throw new Error('No related');
				}
				var promises = relations.map(function (item) {
					return api.mapping(item.term.id, 'organisations')
						.catch(function(err) {
							return null;
						});
				});
				return Promise.all(promises)
					.then(function (results) {
						var organisations = results
							.map(function (organisation, index) {
								var relation = relations[index].term;
								var organisationModel = {
									name: relation.name,
									url: '/stream/organisationsId/' + relation.id,
									conceptId: res.locals.flags.userPrefsUseConceptId ? relation.id : ('organisations:' + ['"', encodeURIComponent(relation.name), '"'].join('')),
									taxonomy: 'organisations',
									tmeId: res.locals.flags.userPrefsUseConceptId ? null : relation.id
								};
								// get the stock id
								relation.attributes.some(function (attribute) {
									if (attribute.key === 'wsod_key') {
										organisationModel.tickerSymbol = attribute.value;
										return true;
									}
									return false;
								});

								return organisationModel;
							})
							// put orgs that can display stock data first
							.sort(function (org1, org2) {
								if (org1.tickerSymbol && !org1.tickerSymbol) {
									return -1;
								} else if (!org1.tickerSymbol && org2.tickerSymbol) {
									return 1;
								} else {
									return 0;
								}
							});
						if (!organisations.length) {
							throw new Error('No related');
						}
						res.render('related/organisations', {
							organisations: organisations
						});
					});

			})
			.catch(function (err) {
				if (err.message === 'No related') {
					res.status(200).end();
				} else if (err instanceof fetchres.ReadTimeoutError) {
					res.status(500).end();
				} else if (err instanceof fetchres.BadServerResponseError) {
					res.status(404).end();
				} else {
					next(err);
				}
			});
	}
};
