const express = require("express");
const router = express.Router();
const db = require("./sql");

// Function to calculate expireStatus based on the endDate
const calculateExpireStatus = (endDate) => {
  const currentDate = new Date();
  const end = new Date(endDate);

  if (end > currentDate) {
    // If the end date is in the future
    const diffInDays = Math.floor((end - currentDate) / (1000 * 3600 * 24));

    if (diffInDays <= 90) {
      return 2; // expire in 3 months
    } else {
      return 1; // issued
    }
  } else {
    // If the end date is in the past
    const diffInDays = Math.floor((currentDate - end) / (1000 * 3600 * 24));

    if (diffInDays <= 30) {
      return 3; // just expired
    } else {
      return 4; // expired
    }
  }
};

// Function to calculate warranty status for each month
const calculateWarrantyStatus = (startDate, endDate, warrantyCount) => {
  const warrantyMonths = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let i = 0; i < warrantyCount; i++) {
    const warrantyMonth = new Date(start);
    warrantyMonth.setMonth(start.getMonth() + i);
    if (warrantyMonth <= end) {
      warrantyMonths.push(warrantyMonth.getMonth()); // Store the month index
    }
  }

  return warrantyMonths;
};

// GET Route for fetching services
router.get("/", async (req, res) => {
  try {
    const query = `
    SELECT 
      service.serviceID, 
      service.DeviceName,
      service.serialNumber,
      service.contractNo,
      service.Brand,
      service.Model,
      service.Type,
      service.Location,
      service.price,
      service.startDate, 
      service.endDate, 
      service.vendorName, 
      service.warrantyCount,
      service.statusID,
      division.divisionID,
      division.divisionName,
      MAX(sd.monthly_charge) AS monthly_charge
    FROM Service AS service
    INNER JOIN Division AS division ON service.divisionID = division.divisionID
    LEFT JOIN ServiceDetail AS sd ON service.serviceID = sd.serviceID
    GROUP BY 
      service.serviceID, service.DeviceName, service.serialNumber, 
      service.contractNo, service.Brand,
      service.Model, service.Type, service.Location, service.price, service.startDate, 
      service.endDate, service.vendorName, service.warrantyCount, service.statusID,
      division.divisionID,division.divisionName
    `;

    const data = await db.connectAndQuery(query);

    // Fetch status names from ServiceExpireCheck table
    const statusQuery = `SELECT status, statusName FROM ServiceExpireCheck`;
    const statusData = await db.connectAndQuery(statusQuery);

    // Convert status data to a dictionary for easy lookup
    const statusMap = statusData.reduce((acc, row) => {
      acc[row.status] = row.statusName;
      return acc;
    }, {});

    // Add expireStatus and warrantyMonths to each service
    const updatedData = data.map((row) => {
      const expireStatus = calculateExpireStatus(row.endDate);
      const warrantyMonths = calculateWarrantyStatus(
        row.startDate,
        row.endDate,
        row.warrantyCount
      );

      return {
        ...row,
        expireStatus,
        expireStatusName: statusMap[expireStatus] || "Unknown",
        warrantyMonths, // Add warranty months to the response
      };
    });

    res.json(updatedData);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
