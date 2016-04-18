/**
 * Created by Андрей on 18.04.2016.
 */

var s = require('require-all')({
    dirname: __dirname + '../../../models',
    resolve: function(model) {
        return model.module;
    }
});


console.log(s)