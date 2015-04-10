"use strict";

/**
 * When instantiated, it creates an isolated event collection.
 * These events can be handled and triggered using the resulted object.
 */
function Events () {
	var self = this;

	/**
	 * Isolated set of events.
	 * @type {Object}
	 */
	var events = {};

	var actionInProgress = {};
	var actionQueue = {};


	function queueAnAction (evt, type, args) {
		if (!actionQueue[evt]) {
			actionQueue[evt] = [];
		}

		actionQueue[evt].push({
			evt: evt,
			type: type,
			args: args
		});
		nextAction(evt);
	}

	function nextAction (evt) {
		if (!actionInProgress[evt]) {
			var action = actionQueue[evt].shift();

			if (action) {
				actionInProgress[evt] = true;

				switch (action.type) {
					case 'off':
						off.apply(self, action.args);
						break;
					case 'trigger':
						trigger.apply(self, action.args);
						break;
				}

				actionInProgress[evt] = false;
				nextAction(evt);
			}
		}
	}

	/**
	 * Registers a new event handler to a specified event which will be called each time the event is triggered.
	 * @param  {string}   evt    Name of the event.
	 * @param  {Function} handler Handler function which will be called when the event is triggered.
	 */
	this.on = function (evt, handler) {
		if (typeof evt !== 'string' || typeof handler !== 'function') {
			return;
		}

		if (!events[evt]) {
			events[evt] = [];
		}
		events[evt].push({
			callback: handler
		});
	};

	/**
	 * Registers a new event handler to a specified event which will be called only the first time the event is triggered.
	 * @param  {string}   event    Name of the event.
	 * @param  {Function} handler Handler function which will be called when the event is triggered.
	 */
	this.one = function (evt, handler) {
		if (typeof evt !== 'string' || typeof handler !== 'function') {
			return;
		}

		if (!events[evt]) {
			events[evt] = [];
		}
		events[evt].push({
			callback: handler,
			once: true
		});
	};


	/**
	 * Helper function to get the index of the handler from the array of handlers attached to an event.
	 * @param  {Array}    arr      Array in which to search.
	 * @param  {Function} handler  Handler function which is searched in the Array.
	 * @return {number}            Index where the handler was found or -1 if not found.
	 */
	function getIndexOfHandler (arr, handler) {
		for (var i=0; i<arr.length; i++) {
			if (arr[i].callback === handler) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Removes event handler(s).
	 * If there's no parameters, all event handlers are removed.
	 * If only the event is specified, all event handlers are removed from that event handler.
	 * If an event handler is specified as well, only that specific event handler will be removed.
	 * @param  {string}   evt   Optional. Name of the event from which the event handler should be removed.
	 * @param  {Function} handler Optional. Handler function to be removed.
	 */
	var off = function (evt, handler) {
		var handlerNotSet = (typeof handler === 'undefined');
		var eventCorrect = (typeof evt === 'string');
		var handlerCorrect = (typeof handler === 'function');

		if (eventCorrect) {
			if (events[evt]) {
				if (handlerNotSet) {
					delete events[evt];
				} else if (handlerCorrect) {
					var index = getIndexOfHandler(events[evt], handler);

					if (index > -1) {
						events[evt].splice(index, 1);
					}
				}
			}
		}
	};

	/**
	 * Queues off process(es) for the event(s).
	 * @param  {string}   evt   Optional. Name of the event from which the event handler should be removed.
	 * @param  {Function} handler Optional. Handler function to be removed.
	 */
	this.off = function (evt, handler) {
		var eventNotSet = (typeof evt === 'undefined');
		var handlerNotSet = (typeof handler === 'undefined');
		var eventCorrect = (typeof evt === 'string');
		var handlerCorrect = (typeof handler === 'function');

		if (eventNotSet) {
			for (var evtKey in events) {
				if (events.hasOwnProperty(evtKey)) {
					queueAnAction(evtKey, 'off', [evtKey]);
				}
			}
		} else {
			if (eventCorrect) {
				if (events[evt]) {
					if (handlerNotSet) {
						queueAnAction(evt, 'off', [evt]);
					} else if (handlerCorrect) {
						queueAnAction(evt, 'off', arguments);
					}
				}
			}
		}
	};

	/**
	 * Triggers an event which causes the call of each handler attached.
	 * @param  {string} evt      Name of the event which will be triggered.
	 * @param  {any}    customData Optional. Data to be passed to handlers.
	 */
	var trigger = function (evt, customData) {
		var i;

		if (events[evt]) {
			if (!(customData instanceof Array)) {
				customData = [customData];
			}

			i=0;
			while (i < events[evt].length) {
				events[evt][i].callback.apply(this, customData);

				if (events[evt][i].once === true) {
					events[evt].splice(i, 1);
				} else {
					i++;
				}
			}
		}
	};

	/**
	 * Queues a trigger process for the event.
	 * @param  {string} evt      Name of the event which will be triggered.
	 * @param  {any}    customData Optional. Data to be passed to handlers.
	 */
	this.trigger = function (evt) {
		queueAnAction(evt, 'trigger', arguments);
	};


	this.destroy = function () {
		events = null;
		actionInProgress = null;
		actionQueue = null;
	};
}
module.exports = Events;
