# Course Tutor - E-Learning Platform

A comprehensive MERN stack e-learning platform that connects students with tutors, featuring course management, real-time messaging, marketplace for study materials, and role-based dashboards.

## 🌟 Features

### 👨‍🎓 Student Dashboard
- **Profile Management**: Complete profile with department, CGPA, year of study, and learning goals
- **Course Discovery**: Browse and enroll in courses offered by approved tutors
- **Tutor Booking**: Book one-on-one sessions with tutors at their hourly rates (BDT)
- **Learning Tracker**: Track progress across enrolled courses and completed sessions
- **Marketplace**: Buy/sell study materials, notes, and resources
- **Real-time Messaging**: Chat with tutors and get support
- **Calendar Integration**: View upcoming sessions and deadlines
- **Review System**: Rate and review tutors and courses

### 👨‍🏫 Tutor Dashboard
- **Profile Management**: Showcase expertise, skills, work experience, and hourly rates
- **Course Creation**: Create and manage courses with detailed curricula
- **Availability Management**: Set available hours and schedule
- **Student Management**: Track enrolled students and their progress
- **Google Meet Integration**: Automated meeting link generation for virtual classrooms
- **Earnings Tracking**: Monitor income from tutoring sessions
- **Marketplace**: Sell study materials and resources
- **Real-time Messaging**: Communicate with students
- **Review Management**: View and respond to student feedback

### 👨‍💼 Admin Dashboard
- **User Management**: Manage all students, tutors, and their accounts
- **Tutor Approval**: Review and approve tutor applications with CV verification
- **Course Oversight**: Monitor and moderate all courses
- **Marketplace Moderation**: Manage reported items and ensure content quality
- **Analytics Dashboard**: View platform statistics and growth metrics
- **Report Handling**: Process user reports and take appropriate actions
- **Content Management**: Moderate reviews, messages, and marketplace items

### 🏪 Marketplace
- **Study Materials Trading**: Buy/sell notes, textbooks, lab reports, projects
- **Department-wise Categorization**: Materials organized by CSE/EEE/BBA departments
- **Digital & Physical Items**: Support for both digital downloads and physical items
- **Review System**: Rate sellers and item quality
- **Search & Filter**: Advanced search with category, department, and price filters
- **Secure Transactions**: Multiple payment methods (Cash, bKash, Nagad, Rocket)

### 💬 Real-time Communication
- **Socket.io Integration**: Instant messaging between students and tutors
- **File Sharing**: Share documents, images, and study materials
- **Typing Indicators**: Real-time typing status
- **Message History**: Persistent chat history
- **Unread Message Tracking**: Notification system for new messages

## 🛠 Tech Stack

### Backend
- **Node.js** with **Express.js** - Server framework
- **MongoDB** with **Mongoose** - Database and ODM
- **Socket.io** - Real-time communication
- **JWT** - Authentication and authorization
- **Multer** - File upload handling
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

### Frontend
- **React.js** with **TypeScript** - User interface
- **React Router** - Client-side routing
- **Context API** - State management
- **Axios** - HTTP client
- **Socket.io-client** - Real-time communication

### Architecture
- **MVC Pattern** - Strict separation of concerns
- **Role-based Access Control** - Different permissions for each user type
- **RESTful APIs** - Clean and consistent API design
- **Responsive Design** - Mobile-first dark theme UI

## 📁 Project Structure

```
course-tutor/
├── backend/
│   ├── models/           # MongoDB schemas (User, Course, Booking, etc.)
│   ├── controllers/      # Business logic controllers
│   ├── routes/          # API routes
│   ├── middleware/      # Authentication, file upload, validation
│   ├── config/          # Database and app configuration
│   ├── uploads/         # File storage directory
│   └── server.js        # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable React components
│   │   ├── pages/       # Dashboard pages
│   │   ├── contexts/    # React Context providers
│   │   ├── hooks/       # Custom React hooks
│   │   ├── utils/       # Utility functions
│   │   └── App.tsx      # Main App component
│   └── public/          # Static assets
└── README.md
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas account
- Git

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Update the `.env` file with your MongoDB connection string:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb+srv://Project:albi123@cluster0.qwoqcmz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET=your_jwt_secret_key_here_make_it_strong_and_secure_2024
   JWT_EXPIRE=30d
   CLIENT_URL=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```
   Server will run on http://localhost:5000

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```
   Frontend will run on http://localhost:3000

## 👤 User Credentials

### Admin Access
- **Email**: admin@coursetutor.com
- **Password**: admin123

### Test Users
Create new student and tutor accounts through the registration page. Tutor accounts require admin approval before they can access their dashboard.

## 📊 Database Models

### User Model
- Authentication and profile information
- Role-based fields (student, tutor, admin)
- Ratings and reviews
- Work experience and skills (for tutors)

### Course Model
- Course details and curriculum
- Enrollment tracking
- Progress monitoring
- Resource management

### Booking Model
- Session scheduling and management
- Payment tracking
- Feedback system
- Cancellation/rescheduling

### Marketplace Model
- Item listings and details
- Purchase history
- Review system
- Category management

### Message Model
- Real-time chat functionality
- File sharing capabilities
- Read status tracking
- Conversation management

## 🎨 UI/UX Features

- **Dark Theme**: Modern dark theme based on provided designs
- **Responsive Design**: Works on all device sizes
- **Smooth Animations**: CSS transitions and hover effects
- **Intuitive Navigation**: Role-based navigation menus
- **Real-time Updates**: Live notifications and status updates

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **Input Validation**: Comprehensive server-side validation
- **File Upload Security**: Secure file handling with type validation
- **Rate Limiting**: Protection against brute force attacks
- **Role-based Access**: Strict permission controls

## 💳 Payment Integration

Currently supports multiple Bangladesh payment methods:
- Cash payments
- bKash
- Nagad
- Rocket
- Bank transfers

## 📱 Real-time Features

- **Live Messaging**: Instant chat between users
- **Online Status**: See who's currently online
- **Typing Indicators**: Real-time typing notifications
- **Push Notifications**: Important updates and reminders

## 🚀 Deployment

### Backend Deployment
1. Set production environment variables
2. Deploy to services like Heroku, AWS, or DigitalOcean
3. Configure MongoDB Atlas for production

### Frontend Deployment
1. Build the production bundle: `npm run build`
2. Deploy to Netlify, Vercel, or any static hosting service
3. Update API endpoints to production URLs

## 📈 Future Enhancements

- **Video Calling**: Direct integration with Google Meet API
- **Mobile App**: React Native version
- **AI Recommendations**: Personalized course and tutor suggestions
- **Advanced Analytics**: Detailed performance metrics
- **Exam System**: Online assessment capabilities
- **Certificate Generation**: Course completion certificates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

Developed by [Your Name] - Full Stack Developer

## 📞 Support

For support and questions:
- Email: support@coursetutor.com
- GitHub Issues: Create an issue in this repository

---

**Note**: This is a comprehensive e-learning platform built with modern technologies and best practices. The codebase follows MVC architecture with proper separation of concerns, making it maintainable and scalable for future enhancements.
