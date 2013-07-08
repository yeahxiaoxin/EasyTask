var fs              = require('fs'),
    avatarLocalDir  = __dirname + '/../public/attachments/avatar/',
    upload          = require('./upload'),
    routeApp        = require('./app'),
    userModel       = require('../model/user').user,
    time            = require('../helper/time'),
    userRole        = require('../model/data').role,
    statusModel     = require('../model/data').statusNames, 
    bugStatus       = require('../model/data').bugStatus,   
    logModel        = require('../model/log').log,
    taskModel       = require('../model/task').task,
    bugModel        = require('../model/bug').bug,
    view            = require('../helper/view');

exports.info = function(req, res) {
    routeApp.ownAuthority(req, function(hasAuth, operator) {
        if (!hasAuth) {
            res.send({ok : 0, msg : 'no user'})
            return
        }

        userModel.findByIp(req.ip, function(err, user) {
            if (err) {
                res.send({ok : 0, msg : 'db error'})
                return
            }

            if (!user) {
                res.send({ok : 0, msg : 'no user'})
                return
            }

            res.send({ok : 1, result : user})
        })
    })
    
}


exports.list = function(req, res) {
    userModel.find({}, {}, {sort : {active : 1, role : 1, created_time : 1}}, function(err, userListResult) {
        res.render('user/index', 
            { 
                title      : '用户列表' ,
                users      : userListResult,
                roles      : userRole,
            }
        )
    })
}

exports.create = function(req, res) {
    var data = req.body,
        role = [];

    if (!data.name || !data.ip) {
        res.send({ok : 0, msg: "不合法"})
        return
    }

    if (isNaN(data.weekWorkLoad)) {
        res.send({ok : 0, msg : '每周工作量必填'});
        return
    }

    if (data.role) {
        if (Array.isArray(data.role)) {
            role = data.role
        } else {
            role = [data.role]
        }
    }

    var newUser = new userModel({
        name                : data.name, 
        ip                  : data.ip,
        role                : role,
        active              : 'open',
        password            : req.body.password || '1234554321',
        avatar_url          : req.body.avatar_url,
        updated_time        : new Date(),
        created_time        : new Date(),
        week_work_load      : parseInt(data.weekWorkLoad) || 90,
        excess_work_load    : 0,
    })

    newUser.save(function(err, userResult) {
        if (err) {
            res.send({ ok : 0, msg : '数据库错误' })
            return
        }

        res.send({ ok : 1 })
    })
}

exports.show = function(req, res) {
    var id          = req.params.id,
        logGroup    = {},
        taskFilter  = {users : id, active : true, deleted : false, status : {$nin : [statusModel[0]]}},
        taskField   = {name : 1, status : 1, branch : 1, custom_id : 1, score : 1, projects : 1},
        bugFilter   = null;

    userModel.findById(id, function(err, userResult) {
        if (!userResult) {
            routeApp.err404(req, res)
            return
        }

        if (userResult.role.indexOf(userRole[1]) > -1) {
            bugFilter   = {assign_to : id, status : {$in : [bugStatus[0], bugStatus[1]]}, closed : false};
        }

        if (userResult.role.indexOf(userRole[2]) > -1) {
            bugFilter   = {operator_id : id, status : {$in : [bugStatus[0], bugStatus[1], bugStatus[2]]}, closed : false};
        }

        taskModel.find(taskFilter, taskField, {sort : {custom_id : -1}},function(err, taskResults) {
            bugModel.findBugsIncludeTaskByAssignTo(bugFilter, function(err, bugResults) {
                logModel.findLogIncludeTaskByUserId(id, 20, function(err, logResults) {
                    logResults.forEach(function(item, index) {
                        var date = time.format_to_date(item.created_time).split(' ')[0]
                        item.created_time = time.format_to_time(item.created_time)
                        if (date in logGroup) {
                            logGroup[date].push(item)
                        } else {
                            logGroup[date] = [item]
                        }
                    })

                    res.render('user/info', 
                        { 
                            title   : userResult.name,
                            user    : userResult,
                            logs    : logGroup,
                            roles   : userRole,
                            tasks   : taskResults,
                            bugs    : bugResults,
                        }
                    )
                })
            })
        })
    })
}

exports.update = function(req, res) {
    var id          = req.params.id,
        updateDoc   = {},
        role        = [];

    routeApp.ownAuthority(req, function(hasAuth, operator) {
        if (!hasAuth) {
            res.send({ok : 0, msg : 'no user'})
            return
        }

        if (!req.body.name || !req.body.ip) {
            res.send({ok : 0, msg: "不合法"})
            return
        }

        if (req.body.role) {
            if (Array.isArray(req.body.role)) {
                role = req.body.role
            } else {
                role = [req.body.role]
            }
        }

        updateDoc = {
            name            : req.body.name,
            ip              : req.body.ip,
            role            : role,
            avatar_url      : req.body.avatar_url,
            updated_time    : new Date(),
        }

        userModel.findByIdAndUpdate(id, updateDoc, function(err, userResult) {
            res.send({ ok : 1 , user : userResult})
        })
    })
}

exports.active = function(req, res) {
    var id          = req.params.id,
        updateDoc   = {};

    if (req.body.active == 'open') {
        updateDoc = {active : 'open'}
    } else {
        updateDoc = {active : 'close'}
    }

    userModel.findByIdAndUpdate(id, updateDoc, function(err, userResult) {
        res.send({ok : 1, user : userResult})
    })
}

exports.delete = function(req, res) {
    var id          = req.params.id
        fileName    = ''

    userModel.findById(id, function(err, userResult) {
        fileName = userResult.avatar_url.split('/')[userResult.avatar_url.split('/').length - 1]

        fs.exists(avatarLocalDir + fileName, function(exists) {
            if (exists) {
                fs.unlink(avatarLocalDir + fileName, function() {
                    deleteUserInfo(req, res) 
                })
            } else {
                deleteUserInfo(req, res)     
            }
            // delete user-info
            function deleteUserInfo(req, res) {
                userModel.findByIdAndRemove(id, function(err) {
                    res.send({ ok : 1 })
                })
            }
        })
    })
}