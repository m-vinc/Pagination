import { _ } from 'meteor/underscore';
import { Meteor } from 'meteor/meteor';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Tracker } from 'meteor/tracker'
import { Counts } from 'meteor/tmeasday:publish-counts';

class PaginationFactory {
  constructor(collection, settingsIn = {}) {
    if (!(this instanceof Meteor.Pagination)) {
      // eslint-disable-next-line max-len
      throw new Meteor.Error(4000, 'The Meteor.Pagination instance has to be initiated with `new`');
    }

    this.collection = collection;
    this.settings = new ReactiveDict();
    const settings = _.extend(
      {
        name : collection._name,
        page: 1,
        perPage: 10,
        filters: {},
        fields: {},
        sort: { _id: 1 },
        debug: false
      },
      settingsIn || {}
    );

	this.settings.set('name', settings.name);

    if (!this.currentPage()) {
      this.currentPage(settings.page);
    }

    if (!this.perPage()) {
      this.perPage(settings.perPage);
    }

    if (!this.filters()) {
      this.filters(settings.filters);
    }

    if (!this.fields()) {
      this.fields(settings.fields);
    }

    if (!this.sort()) {
      this.sort(settings.sort);
    }

    if (!this.debug()) {
      this.debug(settings.debug);
    }

    Tracker.autorun(() => {
        const options = {

          fields: this.fields(),
          sort: this.sort(),
          skip: (this.currentPage() - 1) * this.perPage(),
          limit: this.perPage(),
        };

        if (this.debug()) {
          console.log(
            'Pagination',
            this.settings.get('name'),
            'subscribe',
            JSON.stringify(this.filters()),
            JSON.stringify(options)
          );
          options.debug = true;
        }

        this.settings.set('ready', false);

        const handle = Meteor.subscribe(
          this.settings.get('name'),
          this.filters(),
          options,
          () => {
              this.settings.set('ready', true);
          }
        );

        this.subscriptionId = handle.subscriptionId;
    });
  }

  currentPage(page) {
    if (arguments.length === 1) {
      if (this.settings.get('page') !== page && page >= 1) {
        this.settings.set('page', page);
      }
    }
    return this.settings.get('page');
  }

  perPage(perPage) {
    if (arguments.length === 1) {
      if (this.settings.get('perPage') !== perPage) {
        this.settings.set('perPage', perPage);
      }
    }
    return this.settings.get('perPage');
  }

  filters(filters) {
    if (arguments.length === 1) {
      this.settings.set('filters', !_.isEmpty(filters) ? filters : {});
    }
    return this.settings.get('filters');
  }

  fields(fields) {
    if (arguments.length === 1) {
      this.settings.set('fields', fields);
    }
    return this.settings.get('fields');
  }

  sort(sort) {
    if (arguments.length === 1) {
      this.settings.set('sort', sort);
    }
    return this.settings.get('sort');
  }

  totalItems(totalItems) {
    if (arguments.length === 1) {
      this.settings.set('totalItems', totalItems);
      if (this.currentPage() > 1 && totalItems <= this.perPage() * this.currentPage()) {
        // move to last page available
        this.currentPage(this.totalPages());
      }
    }
    return this.settings.get('totalItems');
  }

  totalPages() {
    const totalPages = this.totalItems() / this.perPage();
    return Math.ceil(totalPages || 1);
  }

  ready() {
    return this.settings.get('ready');
  }

  debug(debug) {
    if (arguments.length === 1) {
      this.settings.set('debug', debug);
    }
    return this.settings.get('debug');
  }

  getPage() {
    const query = {};

    if (this.ready()) {
      this.totalItems(Counts.get(`sub_count_${this.subscriptionId}`));
    }

    query[`sub_${this.subscriptionId}`] = 1;

    const optionsFind = { fields: this.fields(), sort: this.sort() };

    if (this.debug()) {
      console.log(
        'Pagination',
        this.settings.get('name'),
        'find',
        JSON.stringify(query),
        JSON.stringify(optionsFind)
      );
      optionsFind.debug = true;
    }

    return this.collection.find(query, optionsFind).fetch();
  }
}

Meteor.Pagination = PaginationFactory;
