const admin = require('firebase-admin');
const cron = require('node-cron');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function updateTransactionsStatus() {
  const now = new Date(); // get current date
  const transactionsRef = db.collection('transactions');



  const snapshot = await transactionsRef.where('type', '==', 'investment').where('status', '==', 'pending').get();
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }
  
  snapshot.forEach(doc => {
    const data = doc.data()
    const { date, day, profit, email } = data;
    const transactionDate = date.toDate();

    // Calculate the time difference in milliseconds
    const timeDiff = Math.abs(now.getTime() - transactionDate.getTime());

    // Calculate the time difference in seconds
    const diffSeconds = Math.ceil(timeDiff / 1000);

    // convert seconds to days
    const diffDays = diffSeconds / (60 * 60 * 24);

    console.log('diffDay', diffDays)

    if (diffDays >= day) {
      // update transactions status to completed
      doc.ref.update({ status: 'completed' });

      const profileRef = db.collection('profile').doc(email);

      profileRef.get().then((profileSnapshot) => {
        if (profileSnapshot.exists) {
          const profileData = profileSnapshot.data();
          const { balance, profit: mainProfit, investment, savings, withdrawal  } = profileData.bal;
          profileRef.update({bal: { balance, investment, savings, withdrawal,  profit: mainProfit + profit }});
        }
      });
    }
  })

}

// schedule cron job to run every day at midnight
cron.schedule('* * * * *', async () => {
  try {
    await updateTransactionsStatus();
  } catch (error) {
    console.error('Error updating transactions status:', error);
  }
});
