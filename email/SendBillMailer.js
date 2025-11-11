const nodemailer = require("nodemailer");


const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
   auth: {
      user: "megi.mema5@gmail.com",
      pass: "zhxs nwzl rptx zzrd",   
    },
  });
};


const sendBillReminderEmail = async (userEmail, userName, bill) => {
  try {
    const transporter = createTransporter();

    const dueDate = new Date(bill.dueDate).toLocaleDateString();
    const isOverdue = new Date(bill.dueDate) < new Date();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: isOverdue
        ? `⚠️ OVERDUE: ${bill.name} Bill Payment`
        : `🔔 Reminder: ${bill.name} Bill Due Soon`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${isOverdue ? '#ff4757' : '#3742fa'}; color: white; padding: 20px; text-align: center;">
            <h1>${isOverdue ? '⚠️ OVERDUE BILL' : '🔔 Bill Reminder'}</h1>
          </div>
          <div style="padding: 20px; background-color: #f1f2f6;">
            <h2>Hello ${userName},</h2>
            <p style="font-size: 16px;">
              ${isOverdue ? 'Your bill payment is overdue! Please pay as soon as possible to avoid late fees.' :
                'This is a friendly reminder that your bill is due soon.'}
            </p>
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2f3542; margin-bottom: 15px;">Bill Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Bill Name:</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">${bill.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Due Date:</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; color: ${isOverdue ? '#ff4757' : '#2ed573'};">${dueDate}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Amount:</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">$${bill.amount}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold;">Status:</td>
                  <td style="padding: 10px; color: ${isOverdue ? '#ff4757' : '#ffa502'}; font-weight: bold;">
                    ${isOverdue ? 'OVERDUE' : 'DUE SOON'}
                  </td>
                </tr>
              </table>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/bills" 
                 style="background-color: #3742fa; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View Bills Dashboard
              </a>
            </div>
            <p style="color: #57606f; font-size: 14px; text-align: center;">
              This is an automated reminder. Please do not reply to this email.
            </p>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Bill reminder email sent to ${userEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Error sending bill reminder email to ${userEmail}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendBillReminderEmail };
