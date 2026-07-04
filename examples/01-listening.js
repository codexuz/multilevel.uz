
var chiqish = document.getElementById('chiqish').innerHTML;
const InputCheckbox = {
  name: 'input-checkbox',
  model: {
      prop: 'model',
      event: 'change',
  },
  
  props: {
      model: {
          type: [String, Boolean, Object, Number, Array],
          required: true,
      },
      value: {
          type: [String, Boolean, Object, Number],
          required: true,
      },
      falseValue: {
          default: 0,
      },
      label: String,
      disabled: Boolean,
      checked: Boolean,
  },
  
 
  computed: {
      isModelArray() {
          return Array.isArray(this.model);
      },
      isValueObject() {
          return this.value !== null && typeof this.value === 'object';
      },
      isSelected() {
          const { model, value, isEqual, isValueObject, isModelArray } = this;
          
          if (isModelArray) {
              if (isValueObject) {
                  return model.some((obj) => isEqual(obj, value));
              } else {
                  return model.includes(value);
              }
          }

          if (isValueObject) {
              return isEqual(model, value);
          }

          return model === value;
      },
      stateClasses() {
          return {
              'checked': this.isSelected,
              'focused': this.focused,
              'disabled': this.disabled,
          }
      },
  },
  


  methods: {
      toggleCheck() {
          if (!this.disabled) {
              if (this.isModelArray) {
                  this.handleArrayCheckbox();
              } else {
                  this.handleSingleSelectCheckbox();
              }
          }
      },
      handleArrayCheckbox() {
          const newModel = this.model;

          if (!this.isSelected) {
              this.addValueToModel(newModel);
          } else {
              this.removeValueFromModel(newModel);
          }
      },
      handleSingleSelectCheckbox() {
          this.$emit('change', this.isSelected ? this.falseValue : this.value);
      },
      removeValueFromModel(newModel) {
          if (this.isValueObject) {
              newModel = newModel.filter((obj) => !this.isEqual(obj, this.value));
          } else {
              const index = newModel.indexOf(this.value);

              if (index !== -1) {
                  newModel.splice(index, 1);
              }
          }

          this.$emit('change', newModel);
      },
      addValueToModel(newModel) {
          newModel.push(this.value);

          this.$emit('change', newModel);
      },
      isEqual(a, b) {
          return JSON.stringify(a) === JSON.stringify(b);
      },
  },
  
  template: `
      <label :class="['input-checkbox', stateClasses]">
          <input
              type="checkbox"
              :value="value"
              :checked="isSelected"
              :disabled="disabled"
              @change="toggleCheck"
          />

          <span :class="['input-label']">
              {{ label }}
          </span>
      </label>
  `,
};


new Vue({
  el: '#mllistening',
  data () {
    return {
      user_id: null,
      test_numer: 1,
      userdoc: '',
      userfoto: '',
      showModal: false,
      intervalId: 0,
      minutes: '45',
      seconds: '00',
      l_j00: '', l_j01: '', l_j02: '', l_j03: '', l_j04: '', l_j05: '', l_j06: '', l_j07: '', l_j08: '', l_j09: '', l_j10: '', l_j11: '', l_j12: '', l_j13: '', l_j14: '', l_j15: '', l_j16: '', l_j17: '', l_j18: '', l_j19: '', l_j20: '', l_j21: '', l_j22: '', l_j23: '', l_j24: '', l_j25: '', l_j26: '', l_j27: '', l_j28: '', l_j29: '', l_j30: '', l_j31: '', l_j32: '', l_j33: '', l_j34: '', l_j35: ''
    };
  },
  components: {
      InputCheckbox,
  },

  created() {
    this.user_id = chiqish;
    this.getUserDoc();
  },
  mounted () {
    this.startTimer(60 * 45)
  },

  methods: {
    startTimer (duration, display) {
        var timer = duration,
          minutes,
          seconds
        this.intervalId = setInterval(() => {
          this.minutes = parseInt(timer / 60, 10)
          this.seconds = parseInt(timer % 60, 10)
  
          this.minutes = this.minutes < 10 ? "0" + this.minutes : this.minutes
          this.seconds = this.seconds < 10 ? "0" + this.seconds : this.seconds
  
          if (--timer < 0) {
            clearInterval(this.intervalId)
            this.putMlListening();
          }
          else if (this.minutes ==0 && this.seconds == 59) {
            this.showModal= true;
          }
          else{
          }
        }, 1000)
    },
    getUserDoc(user_id) {
        user_id = this.user_id,
        axios.get(`https://mytests.uz/api/user/${user_id}`)
        .then(response => { 
          this.userdoc = response.data;
          if(response.data.foto == null){
          this.userfoto = '/fotouser/fotouser.jpg';
        }
        else{
          this.userfoto = '/fotouser/'+response.data.foto ;
        }
        })
        .catch(error => {
          return 'Error: ' + error.response.status
        });
      },

    putMlListening() {
      axios.put('https://mytests.uz/api/mllistening', {l_j01: this.l_j01,l_j02: this.l_j02,l_j03: this.l_j03,l_j04: this.l_j04,l_j05: this.l_j05,l_j06: this.l_j06,l_j07: this.l_j07,l_j08: this.l_j08,l_j09: this.l_j09,l_j10: this.l_j10,l_j11: this.l_j11,l_j12: this.l_j12,l_j13: this.l_j13,l_j14: this.l_j14,l_j15: this.l_j15,l_j16: this.l_j16,l_j17: this.l_j17,l_j18: this.l_j18,l_j19: this.l_j19,l_j20: this.l_j20,l_j21: this.l_j21,l_j22: this.l_j22,l_j23: this.l_j23,l_j24: this.l_j24,l_j25: this.l_j25,l_j26: this.l_j26,l_j27: this.l_j27,l_j28: this.l_j28,l_j29: this.l_j29,l_j30: this.l_j30,l_j31: this.l_j31,l_j32: this.l_j32,l_j33: this.l_j33,l_j34: this.l_j34,l_j35: this.l_j35,
      user_id: this.user_id,
      test_numer: this.test_numer
      }).then(response => {
        window.location.href = 'multilevel';
      }).catch(error => {
        return 'Error: ' + error.response.status
      });
    },
  },


});
