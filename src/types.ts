export interface UserProfile {
  uid: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  displayName: string;
  photoURL?: string;
  balance: number;
  status: 'pending' | 'approved' | 'rejected'; // For teachers/admins
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  teacherId: string;
  teacherName: string;
  price: number;
  description: string;
  thumbnail: string;
  category: string;
  studentsCount: number;
  revenue: number;
  content: CourseModule[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface CourseModule {
  id: string;
  title: string;
  items: CourseItem[];
}

export type CourseItem = Lesson | Quiz;

export interface Lesson {
  type: 'lesson';
  id: string;
  title: string;
  videoSource?: 'url' | 'file';
  videoUrl?: string;
  content?: string; // Markdown supported
  pdfSource?: 'url' | 'file';
  pdfUrl?: string;
  pdfName?: string;
}

export interface Quiz {
  type: 'quiz';
  id: string;
  title: string;
  questions: Question[];
  embedCode?: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
}
