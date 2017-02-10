import Composer from 'discourse/models/composer';
import ComposerController from 'discourse/controllers/composer';
import ComposerBody from 'discourse/components/composer-body';
import TopicStatusView from 'discourse/raw-views/topic-status';
import topicIconClass from '../lib/topic-icon';
import DiscoveryRoute from 'discourse/routes/application';
import TopicRoute from 'discourse/routes/topic';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';

export default {
  name: 'discovery-compose',
  initialize(){

    Composer.reopen({
      showCategoryChooser: false
    })

    ComposerBody.reopen({
      @on('didInsertElement')
      showHideComposeBody() {
        if (window.location.pathname.indexOf('/t/') === -1) {
          this.setup();
          $(document).on('click', Ember.run.bind(this, this.handleClick));
          $(document).on('resize', Ember.run.bind(this, this.handleResize));
        }
      },

      handleClick: function(event) {
        let $element = this.$();
        let $target = $(event.target);

        if ($target.closest($element).length) {
          this.resizeFull();
        } else {
          this.resizePartial();
        }
      },

      handleResize: function(event) {
        let titleWidth = $('.title-input').width() - 21;
        $('#reply-title').css('width', `${titleWidth}px`)
      },

      setup: function() {
        this.resizePartial();
        this.resizeControls();
      },

      resizeControls() {
        let self = this;
        Ember.run.scheduleOnce('afterRender', this, function() {
          const fieldsHeight = self.$('.composer-fields').height();
          self.$('.wmd-controls').css('top', `${fieldsHeight}px`)
        })
      },

      resizePartial() {
        let self = this;
        Ember.run.scheduleOnce('afterRender', this, function() {
          if (!self.$()) { return }

          self.$('.submit-panel, .reply-to, .topic-type-choice').hide();
          self.$().css('height', '48px');
        })
      },

      resizeFull: function() {
        let self = this;
        Ember.run.scheduleOnce('afterRender', this, function() {
          if (!self.$()) { return }

          self.$().css('height', '400px');
          self.$('.topic-type-choice').show();
          Ember.run.later((function() {
            self.$('.submit-panel').show();
          }), 300);
        })
      },

      @on('willDestroy')
      destroyExpandEvent() {
        $(document).off('click', Ember.run.bind(this, this.handleClick));
        $(document).off('resize', Ember.run.bind(this, this.handleResize));
      }
    })

    TopicStatusView.reopen({
      renderDiv: true,

      @observes('statuses')
      @on('init')
      _setup(){
        let type = this.get('topic.type')
        let topicIcon = {
          icon: topicIconClass(type),
          title: I18n.t("topic." + type + ".title"),
          openTag: 'span',
          closeTag: 'span'
        }
        this.get('statuses').pushObject(topicIcon)
      }
    })

    DiscoveryRoute.reopen({
      firstRenderDiscovery: false,
      transitionToDiscovery: false,

      disconnectComposer: function() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      },

      isDiscoveryPath: function() {
        const pathSlug = window.location.pathname.split('/')[1];
        const filters = Discourse.Site.currentProp('filters');
        let filterPath = pathSlug === '' || filters.filter(function(filter) {
                           return pathSlug === filter;
                         }).length > 0;
        let categoryPath = pathSlug === 'c';
        let categoriesPath = pathSlug === 'categories';
        return filterPath || categoryPath || categoriesPath
      },

      renderTemplate(controller, model) {
        this._super();
        if (this.currentUser && this.isDiscoveryPath()) {
          this.disconnectComposer();
          this.set('firstRenderDiscovery', true)
        }
      },

      actions: {

        didTransition: function() {
          this._super();
          if (this.currentUser && (this.get('firstRenderDiscovery') || this.get('transitionToDiscovery'))) {
            this.openComposer(this.controllerFor("discovery/topics"));
            this.setProperties({
              'firstRenderDiscovery': false,
              'transitionToDiscovery': false
            })
          }
          return true; // Bubble the didTransition event
        },

        willTransition: function(transition) {
          if (this.currentUser) {
            if (transition.targetName.indexOf('discovery') > -1) {
              this.disconnectComposer();
              this.set('transitionToDiscovery', true)
            } else {
              this.controllerFor('composer').shrink();
              this.set('transitionToDiscovery', false)
            }
          }
        }
      }
    })

    TopicRoute.reopen({
      @on('activate')
      addComposer() {
        if (this.currentUser) {
          this.render('composer', {into: 'application', outlet: 'composer'})
        }
      },

      @on('deactivate')
      removeComposer() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      }
    })
  }
};
