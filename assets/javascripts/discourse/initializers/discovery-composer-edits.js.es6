import Composer from 'discourse/models/composer';

export default {
  name: 'discovery-compose',
  initialize(){
    Composer.serializeOnCreate('wiki')
  }
};
