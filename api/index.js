const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const port = 8000;
const cors = require('cors');
const Employee = require('./models/employee');
const Attendance = require('./models/attendance');
const moment = require('moment');
app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

mongoose
  .connect('mongodb+srv://jagupta:jaygupta@cluster0.wwnu8ia.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(error => {
    console.log('Error connecting to MongoDB', error);
  });

app.listen(port, () => {
  console.log('Server is running on port 8000');
});

// To register a Employee
app.post('/addEmployee', async (req, res) => {
  try {
    const {
      employeeName,
      employeeId,
      designation,
      phoneNumber,
      dateOfBirth,
      joiningDate,
      activeEmployee,
      salary,
      address,
    } = req.body;

    //create a new Employee
    const newEmployee = new Employee({
      employeeName,
      employeeId,
      designation,
      phoneNumber,
      dateOfBirth,
      joiningDate,
      activeEmployee,
      salary,
      address,
    });

    await newEmployee.save();
    res.status(201).json({
      message: 'Employee details saved successfully',
      employee: newEmployee,
    });
  } catch (error) {
    console.log('Error while creating Employee', error);
    res.status(500).json({message: 'Failed to add a new Employee'});
  }
});

// To fetch all the employees

app.get('/employees', async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({message: 'Failed to retrieve the employees'});
  }
});

app.post('/attendances', async (req, res) => {
  try {
    const {employeeId, employeeName, date, status} = req.body;

    const existingAttendance = await Attendance.findOne({employeeId, date});

    if (existingAttendance) {
      existingAttendance.status = status;
      await existingAttendance.save();
      res.status(200).json(existingAttendance);
    } else {
      const newAttendance = new Attendance({
        employeeId,
        employeeName,
        date,
        status,
      });
      await newAttendance.save();
      res.status(200).json(newAttendance);
    }
  } catch (error) {
    res.status(500).json({message: 'Error submitting Attendance'});
  }
});

app.get('/attendances', async (req, res) => {
  try {
    const {date} = req.query;
    console.log('req: ', req.query);

    const attendanceData = await Attendance.find({date: date});

    res.status(200).json(attendanceData);
  } catch (error) {
    res.status(500).json({message: 'Error fetching Attendance'});
  }
});

app.get('/attendance-report-all-employees', async (req, res) => {
  try {
    const {month, year} = req.query;

    console.log('query parameters', month, year);

    const startDate = moment(`${year}-${month}-01`, 'YYYY-MM-DD')
      .startOf('month')
      .toDate();

    const endDate = moment(startDate).endOf('month').toDate();

    const report = await Attendance.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              {
                $eq: [
                  {$month: {$dateFromString: {dateString: '$date'}}},
                  parseInt(req.query.month),
                ],
              },
              {
                $eq: [
                  {$year: {$dateFromString: {dateString: '$date'}}},
                  parseInt(req.query.year),
                ],
              },
            ],
          },
        },
      },

      {
        $group: {
          _id: '$employeeId',
          present: {
            $sum: {
              $cond: {if: {$eq: ['$status', 'present']}, then: 1, else: 0},
            },
          },
          absent: {
            $sum: {
              $cond: {if: {$eq: ['$status', 'absent']}, then: 1, else: 0},
            },
          },
          halfday: {
            $sum: {
              $cond: {if: {$eq: ['$status', 'halfday']}, then: 1, else: 0},
            },
          },
          holiday: {
            $sum: {
              $cond: {if: {$eq: ['$status', 'holiday']}, then: 1, else: 0},
            },
          },
        },
      },
      {
        $lookup: {
          from: 'employees', // Name of the employee collection
          localField: '_id',
          foreignField: 'employeeId',
          as: 'employeeDetails',
        },
      },
      {
        $unwind: '$employeeDetails', // Unwind the employeeDetails array
      },
      {
        $project: {
          _id: 1,
          present: 1,
          absent: 1,
          halfday: 1,
          name: '$employeeDetails.employeeName',
          designation: '$employeeDetails.designation',
          salary: '$employeeDetails.salary',
          employeeId: '$employeeDetails.employeeId',
        },
      },
    ]);

    res.status(200).json({report});
  } catch (error) {
    res.status(500).json({message: 'Error fetching summary report'});
  }
});