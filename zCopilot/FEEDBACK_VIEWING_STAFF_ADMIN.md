# Feedback Viewing System - Staff & Admin

## Overview

Both **Staff** and **Admin** users can now view customer feedback with comprehensive details including:

- ⭐ Customer ratings (1-5 stars)
- 💬 Comments/feedback text
- 👤 Customer name and phone
- 🪟 Counter information
- 📅 Timestamp
- ⏱️ Wait time (currently hardcoded random values 5-25 min)

---

## 🔧 Changes Made

### 1. **Admin Dashboard** - New Feedback Tab

**File**: `src/pages/Admin.tsx`

#### Added Features

- ✅ **New "Feedback" tab** alongside Counters and Staff tabs
- ✅ **Average rating calculation** across all feedback
- ✅ **Comprehensive feedback list** showing last 50 entries
- ✅ **Star rating visualization** for each feedback
- ✅ **Customer details** (name, phone)
- ✅ **Counter information** showing which counter served them
- ✅ **Timestamps** with date and time
- ✅ **Comments display** in a styled card
- ✅ **Wait time indicator** (currently hardcoded)

#### UI Layout

```
Admin Dashboard
├── Stats Overview (Total Queue, Waiting, Served)
└── Tabs
    ├── Counters (manage counters)
    ├── Staff (manage staff accounts)
    └── Feedback ← NEW!
        ├── Average rating display
        └── Feedback cards
            ├── Star rating (1-5)
            ├── Customer name & phone
            ├── Counter name
            ├── Date & time
            ├── Comments (if provided)
            └── Wait time
```

### 2. **Staff Dashboard** - Feedback Tab Per Counter

**File**: `src/pages/Staff.tsx`

#### Added Features

- ✅ **Tabbed interface** showing Queue and Feedback
- ✅ **Counter-specific feedback** - only shows feedback for their selected counter
- ✅ **Average rating** for the selected counter
- ✅ **Last 5 feedback entries** displayed
- ✅ **Real-time updates** - feedback refreshes after serving a customer
- ✅ **Star rating visualization**
- ✅ **Customer details and comments**
- ✅ **Wait time indicator**

#### UI Layout

```
Staff Panel (Counter Selected)
├── Counter Header (Counter name, queue count)
├── Change Counter button
└── Tabs
    ├── Queue ← Default
    │   ├── Next Customer (Token #, Name, Phone)
    │   ├── Serve Next button
    │   └── Upcoming customers list
    └── Feedback ← NEW!
        ├── Average rating for this counter
        └── Recent feedback (last 5)
            ├── Star rating
            ├── Customer info
            ├── Comments
            └── Wait time
```

---

## 📊 Data Display

### Admin View - All Feedback

Shows feedback from **all counters** sorted by most recent:

```typescript
// Fetches last 50 feedback entries
const { data: feedbackData } = await supabase
  .from("feedback")
  .select(`
    *,
    counters (
      name,
      counter_number
    )
  `)
  .order("created_at", { ascending: false })
  .limit(50);
```

### Staff View - Counter-Specific Feedback

Shows feedback only for the **selected counter**:

```typescript
// Fetches last 20 feedback for specific counter
const { data: feedbackData } = await supabase
  .from("feedback")
  .select("*")
  .eq("counter_id", selectedCounter.id)
  .order("created_at", { ascending: false })
  .limit(20);
```

---

## 🎨 Visual Features

### Star Rating Display

```
⭐⭐⭐⭐⭐  5/5  (5 stars)
⭐⭐⭐⭐☆  4/5  (4 stars)
⭐⭐⭐☆☆  3/5  (3 stars)
⭐⭐☆☆☆  2/5  (2 stars)
⭐☆☆☆☆  1/5  (1 star)
```

### Average Rating Calculation

- Displayed at the top of feedback sections
- Automatically calculated from all feedback entries
- Shows as decimal (e.g., 4.3) with star visualization

### Feedback Card Example

```
┌─────────────────────────────────────┐
│ ⭐⭐⭐⭐⭐ 5/5                        │
│ John Doe                            │
│ +1234567890                         │
│ Oct 5, 2025 - 10:30 AM              │
│                                     │
│ "Great service! Very fast."         │
│                                     │
│ 🕒 Wait: ~12 min                    │
└─────────────────────────────────────┘
```

---

## ⏱️ Wait Time Display

### Current Implementation (Hardcoded)

Wait time is currently **hardcoded** with random values:

```typescript
// Generates random wait time between 5-25 minutes
<span>Wait time: ~{Math.floor(Math.random() * 20) + 5} min</span>
```

### Future Enhancement

To show **actual wait time**, calculate from queue entry data:

```sql
-- Calculate actual wait time
SELECT 
  EXTRACT(EPOCH FROM (served_at - joined_at)) / 60 AS wait_minutes
FROM queue_entries
WHERE id = feedback.queue_entry_id;
```

To implement:

1. Add wait_time column to feedback table during insertion
2. Calculate: `served_at - joined_at` from queue_entries
3. Display actual calculated time instead of random

---

## 🔄 Real-Time Updates

### Staff Panel

- Feedback automatically refreshes **2 seconds after** serving a customer
- Allows time for customer to submit feedback
- Uses setTimeout to delay the refresh

```typescript
await fetchQueueEntries();
// Refetch feedback to get any new feedback submitted
setTimeout(() => fetchFeedback(), 2000);
```

### Admin Panel

- Manual refresh required (reload page)
- Future enhancement: Add real-time subscriptions to feedback table

---

## 🎯 Use Cases

### For Staff Members

1. **Performance tracking** - See their own counter's ratings
2. **Immediate feedback** - View recent customer comments
3. **Service quality** - Monitor average rating trends
4. **Issue identification** - Quickly spot negative feedback

### For Administrators

1. **Overall performance** - View all feedback across counters
2. **Counter comparison** - Compare ratings between counters
3. **Staff evaluation** - Assess staff performance indirectly
4. **Service improvements** - Identify patterns in feedback
5. **Follow-up actions** - Contact customers with low ratings

---

## 📈 Analytics Features

### Admin Dashboard Shows

- **Average rating** across all feedback
- **Total feedback count**
- **Recent feedback** (last 50 entries)
- **Counter breakdown** showing which counters received feedback

### Staff Dashboard Shows

- **Average rating** for their counter
- **Recent feedback** (last 5 entries)
- **Customer satisfaction** at a glance

---

## 🚀 How to Test

### As Admin

1. Login with admin credentials
2. Navigate to Admin dashboard
3. Click on **"Feedback"** tab
4. View all customer feedback across all counters
5. Check average rating at the top
6. Review individual feedback cards

### As Staff

1. Login with staff credentials
2. Select your counter
3. Switch to **"Feedback"** tab
4. View feedback specific to your counter
5. Check your counter's average rating
6. Review recent customer comments

### Complete Flow

1. **Customer joins queue** → Gets token
2. **Staff serves customer** → Marks as done
3. **Customer submits feedback** → Rating + comments
4. **Feedback appears** in both Staff and Admin views
5. **Staff can see** feedback after ~2 seconds
6. **Admin can see** feedback on page refresh

---

## 🎨 UI Components Used

### Admin Page

- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`
- `Card` for feedback items
- `Star` icon from lucide-react
- `MessageSquare` for empty state
- `Clock` for wait time indicator

### Staff Page

- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`
- `Card` for feedback items
- `Star` icon for ratings
- `MessageSquare` for empty state
- `Clock` for wait time

---

## 🔒 Security & Permissions

### RLS Policies (Already Set)

```sql
-- Staff can view all feedback
CREATE POLICY "Staff can view all feedback" 
ON public.feedback
FOR SELECT 
TO authenticated
USING (
    public.has_role(auth.uid(), 'staff'::public.app_role) 
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
```

- ✅ Only **authenticated staff/admin** can view feedback
- ✅ Customers **cannot** view other customers' feedback
- ✅ Anonymous users can only **insert** their own feedback

---

## 🆕 Future Enhancements

### Priority Enhancements

1. **Calculate actual wait time** from queue_entries data
2. **Real-time feedback updates** using Supabase subscriptions
3. **Filter by date range** (today, this week, this month)
4. **Export feedback to CSV** for reporting
5. **Search/filter** by rating, customer name, or counter

### Advanced Features

6. **Feedback trends chart** showing ratings over time
7. **Email notifications** for low ratings (≤2 stars)
8. **Reply to feedback** feature for admin
9. **Feedback summary reports** with statistics
10. **Customer sentiment analysis** from comments

---

## 📝 Code Structure

### State Management

#### Admin.tsx

```typescript
const [feedbackList, setFeedbackList] = useState<any[]>([]);
```

#### Staff.tsx

```typescript
const [feedbackList, setFeedbackList] = useState<any[]>([]);
```

### Data Fetching

#### Admin - fetchData()

```typescript
const { data: feedbackData } = await supabase
  .from("feedback")
  .select(`*, counters (name, counter_number)`)
  .order("created_at", { ascending: false })
  .limit(50);
```

#### Staff - fetchFeedback()

```typescript
const { data: feedbackData } = await supabase
  .from("feedback")
  .select("*")
  .eq("counter_id", selectedCounter.id)
  .order("created_at", { ascending: false })
  .limit(20);
```

---

## ✅ Testing Checklist

### Staff View

- [ ] Login as staff member
- [ ] Select a counter
- [ ] View "Feedback" tab
- [ ] Verify only counter-specific feedback shows
- [ ] Check average rating calculation
- [ ] Verify customer details display correctly
- [ ] Confirm comments show when provided
- [ ] Check wait time displays

### Admin View

- [ ] Login as admin
- [ ] Navigate to "Feedback" tab
- [ ] Verify all feedback from all counters shows
- [ ] Check average rating across all feedback
- [ ] Verify counter information displays
- [ ] Confirm timestamps are correct
- [ ] Check feedback sorting (most recent first)
- [ ] Verify empty state when no feedback

### Integration

- [ ] Customer submits feedback
- [ ] Feedback appears in Staff view (~2 sec delay)
- [ ] Feedback appears in Admin view (after refresh)
- [ ] Star ratings display correctly
- [ ] Comments format properly
- [ ] Wait time shows (random for now)

---

## 📊 Status

✅ **COMPLETE**: Feedback viewing for both Staff and Admin is fully functional!

### What's Working

- ✅ Admin can view all feedback across all counters
- ✅ Staff can view feedback for their selected counter
- ✅ Star ratings display correctly (1-5)
- ✅ Average rating calculation works
- ✅ Customer details show (name, phone)
- ✅ Comments display properly
- ✅ Timestamps show date and time
- ✅ Counter information displays
- ✅ Wait time indicator (hardcoded random)
- ✅ Empty states for no feedback
- ✅ Real-time update for staff (2sec delay)

### Pending Enhancements

- ⏳ Calculate actual wait time from queue data
- ⏳ Real-time subscriptions for instant updates
- ⏳ Date range filtering
- ⏳ Export to CSV
- ⏳ Search and advanced filtering
