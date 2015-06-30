'use strict';

var $ = require('cheerio');
var resize = require('../utils/resize');
var api = require('next-ft-api-client');
var logger = require('ft-next-logger');
var capiMapiRegex = require('../utils/capi-mapi-regex').content;

module.exports = function($body, opts) {
	var fullWidthMainImages = opts && opts.fullWidthMainImages;
	var fullWidthInlineImages = opts && opts.fullWidthInlineImages;

	var imageSetSelector = 'ft-content[type$="ImageSet"]';
	var imageSetPromises = $body(imageSetSelector)
		.map(function (index, el) {
			return api.content({ uuid: $(el).attr('url').replace(capiMapiRegex, ''), type: 'ImageSet' })
				.catch(function(error) {
					logger.error(error);
					return {};
				});
		})
		.get();

	// get the image sets
	return Promise.all(imageSetPromises)
		.then(function (imageSets) {
			$body(imageSetSelector).replaceWith(function (index, image) {
				// get the image set data
				var $image = $(image);
				var id = $image.attr('url').replace(capiMapiRegex, '');
				var imageSet;
				imageSets.some(function (set) {
					if (set.id && set.id.replace('http://www.ft.com/thing/', '') === id) {
						imageSet = set;
						return true;
					} else {
						return false;
					}
				});
				if (!imageSet) {
					return '';
				}

				// image is main if it's the first item in the article
				var isMain = fullWidthMainImages && $body.root().children().get(0) === image;
				var isFullWidth = fullWidthInlineImages && /\{L\}$/.test(imageSet.description);
				var width = isMain ? 710 : (isFullWidth ? 790 : 480);
				var binaryId = imageSet.members[0].id.replace(capiMapiRegex, '');
				var imageUrl = resize('ftcms:' + binaryId, { width: width });
				var $figure = $('<figure></figure>')
					.addClass('article__image-wrapper ng-figure-reset');

				if ($image.parent().hasClass('article__promo-box')) {
					$figure.addClass('article__promo-box__image');
					if ($image.parent().hasClass('article__promo-box__long')) {
						$figure.addClass('article__promo-box__long__image');
					}					
				} else if ($image.parent().is('td')) {
					$figure.addClass('data-table__image');
				} else {
					if (!isMain) {
						if (isFullWidth) {
							$figure.addClass('article__full-width-image');
						} else {
							$figure.addClass('article__inline-image ng-pull-out ng-inline-element');
						}
					} else {
						$figure.addClass('article__main-image ng-media-wrapper');
					}
				}

				if (imageSet.title) {
					var $figcaption = $('<figcaption></figcaption>')
						.addClass('article__image-caption ng-meta')
						.text(imageSet.title);

					$figure.append($figcaption);
				}
				var $newImage = $('<img></img>')
					.addClass('article__image')
					.attr('src', imageUrl)
					.attr('alt', imageSet.description.replace(/\{\w\}$/, ''));
				if (isMain) {
					$newImage.addClass('ng-media');
				}
				$figure.prepend($newImage);

				if ($image.parent('p').length) {
					$image.parent('p').before($figure);
					return '';
				} else {
					return $figure;
				}
			});

			return $body;
		});
};
