var mongoose        = require('./config').mongoose,
    ObjectId        = mongoose.Schema.Types.ObjectId,
    collectionName  = 'milestone';

var milestoneSchema = mongoose.Schema({
    name            : String,
    task_id         : String,
    event_time      : Date,
    created_time    : Date,
},{ 
    collection: collectionName, 
})

var Milestone = mongoose.model(collectionName, milestoneSchema)

exports.milestone = Milestone