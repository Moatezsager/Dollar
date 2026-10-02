import express from 'express';
import { db } from '../../db';

const router = express.Router();

// Messages management
router.get('/messages', (req: express.Request, res: express.Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM messages ORDER BY created_at DESC');
    const messages = stmt.all();
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب الرسائل" });
  }
});

router.put('/messages/:id/status', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['new', 'read', 'replied'].includes(status)) {
      return res.status(400).json({ error: "حالة غير صالحة" });
    }

    const stmt = db.prepare('UPDATE messages SET status = ? WHERE id = ?');
    stmt.run(status, id);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating message status:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تحديث حالة الرسالة" });
  }
});

router.delete('/messages/:id', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "حدث خطأ أثناء حذف الرسالة" });
  }
});

export default router;
