import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, GraduationCap, School, LogIn, ShoppingCart, BookOpen, MessageSquare, DollarSign, PlusCircle, CheckCircle, XCircle, ShieldCheck, LayoutDashboard, Plus, Trash2, Video, FileText, ListTodo, ChevronDown, ChevronUp, GripVertical, PlayCircle, HelpCircle, Sparkles, FileUp, Loader2, Cpu, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { auth, loginWithGoogle, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, query, addDoc, doc, setDoc, getDoc, onSnapshot, where, deleteDoc } from 'firebase/firestore';
import { getMathTutorResponse, testGeminiConnection, setGlobalApiKey, getApiKeySource, clearLocalApiKey } from './lib/gemini';
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { UserProfile, Course, CourseModule, CourseItem, Lesson, Quiz, Question } from './types';
import mathCenterLogo from './assets/images/math_center_logo_1782392727551.jpg';

const MASTER_ADMIN_EMAIL = "bfgdht45@gmail.com";

// ================= COURSE MODAL =================
const CourseModal = ({ userId, userName, course, onOpenChange }: { userId: string, userName: string, course?: Course | null, onOpenChange: (open: boolean) => void }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [formData, setFormData] = useState({
    title: course?.title || '',
    description: course?.description || '',
    price: course?.price?.toString() || '',
    category: course?.category || 'جبر',
    thumbnail: course?.thumbnail || ''
  });
  const draftKey = course?.id ? `course_draft_${course.id}` : 'course_draft_new';
  const [modules, setModules] = useState<CourseModule[]>(() => {
    const savedDraft = localStorage.getItem(draftKey);
    return savedDraft ? JSON.parse(savedDraft) : (course?.content || []);
  });

  // Save draft to localStorage
  useEffect(() => {
    if (modules.length > 0) {
      localStorage.setItem(draftKey, JSON.stringify(modules));
    }
  }, [modules, draftKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const courseData = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price) || 0,
        category: formData.category,
        thumbnail: formData.thumbnail || 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80',
        teacherId: userId,
        teacherName: userName,
        content: modules,
        updatedAt: new Date().toISOString()
      };

      // Firestore document size limit check (approximate)
      const dataSize = JSON.stringify(courseData).length;
      if (dataSize > 980000) { // Keep it safely under 1,048,576 bytes
        toast.error("حجم بيانات الكورس كبير جداً. يرجى تقليل حجم الفيديوهات المرفوعة أو استخدام روابط يوتيوب.");
        setLoading(false);
        return;
      }

      if (course?.id) {
        await setDoc(doc(db, 'courses', course.id), { ...courseData }, { merge: true });
        toast.success("تم تحديث الكورس وحفظ جميع التعديلات في قاعدة البيانات بنجاح");
      } else {
        const docRef = await addDoc(collection(db, 'courses'), {
          ...courseData,
          studentsCount: 0,
          revenue: 0,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        
        // Final verification check
        if (docRef.id) {
          toast.success("تم إرسال الكورس وتأكيد حفظه في قاعدة البيانات (بانتظار المراجعة)");
        } else {
          throw new Error("فشل في استلام تأكيد الحفظ من السيرفر");
        }
      }
      localStorage.removeItem(draftKey);
      onOpenChange(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
      toast.error("فشل في حفظ الكورس. قد يكون حجم البيانات كبيراً جداً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-4 text-right">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 bg-slate-100 rounded-xl">
          <TabsTrigger value="info" className="rounded-lg">1. المعلومات العامة</TabsTrigger>
          <TabsTrigger value="curriculum" className="rounded-lg">2. المنهج الدراسي</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit}>
          <TabsContent value="info" className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-sm font-medium">عنوان الكورس</label>
              <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="مثال: الجبر المتقدم" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">الوصف</label>
              <textarea 
                 className="flex min-h-[100px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                 required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="عرض موجز لمحتوى الكورس" 
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">السعر ($)</label>
                <Input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="29.99" />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">التصنيف</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option>جبر</option>
                  <option>هندسة</option>
                  <option>تفاضل وتكامل</option>
                  <option>إحصاء</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">رابط صورة الغلاف</label>
              <Input value={formData.thumbnail} onChange={e => setFormData({...formData, thumbnail: e.target.value})} placeholder="https://..." />
            </div>
            <Button type="button" onClick={() => setActiveTab('curriculum')} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl mt-4">
              التالي: بناء المنهج
            </Button>
          </TabsContent>

          <TabsContent value="curriculum" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300 flex flex-col min-h-[400px]">
            <div className="flex-1">
              <CurriculumBuilder modules={modules} onChange={setModules} />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t sticky bottom-0 bg-white pb-2 mt-auto z-10 -mx-4 px-4 sm:-mx-8 sm:px-8">
              <Button type="button" variant="outline" onClick={() => setActiveTab('info')} className="flex-1 rounded-xl h-12 order-2 sm:order-1 border-slate-200">رجوع</Button>
              <Button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 h-12 rounded-xl text-lg font-bold order-1 sm:order-2" disabled={loading}>
                {loading ? "جاري الحفظ..." : "حفظ الكل ونشر الكورس"}
              </Button>
            </div>
          </TabsContent>
        </form>
      </Tabs>
    </div>
  );
};

// ================= CURRICULUM BUILDER =================
const CurriculumBuilder = ({ modules, onChange }: { modules: CourseModule[], onChange: (modules: CourseModule[]) => void }) => {
  const [uploadingItemIds, setUploadingItemIds] = useState<{[id: string]: boolean}>({});
  const [uploadProgress, setUploadProgress] = useState<{[id: string]: number}>({});

  const uploadFileInChunks = async (
    file: File, 
    onProgress: (percent: number) => void
  ): Promise<string> => {
    // 2MB chunking for perfect resilience against network resets and proxy request bounds
    const chunkSize = 2 * 1024 * 1024; 
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = Math.random().toString(36).substring(2, 15);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const formDataBytes = new FormData();
      formDataBytes.append("chunkIndex", i.toString());
      formDataBytes.append("totalChunks", totalChunks.toString());
      formDataBytes.append("filename", file.name);
      formDataBytes.append("uploadId", uploadId);
      formDataBytes.append("chunk", chunk, file.name);
      
      const response = await fetch('/api/upload-chunk', {
        method: "POST",
        body: formDataBytes
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error("Chunk upload failed text response:", text);
        try {
          const json = JSON.parse(text);
          throw new Error(json.error || `فشل رفع الجزء رقم ${i + 1}`);
        } catch (_) {
          throw new Error(`فشل رفع جزء الملف (${response.status})`);
        }
      }
      
      const data = await response.json();
      const percent = Math.round(((i + 1) / totalChunks) * 100);
      onProgress(percent);
      
      if (data.completed && data.url) {
        return data.url;
      }
    }
    
    throw new Error("لم تكتمل عملية التجميع بعد إرسال كافة الأجزاء");
  };

  const uploadFile = async (
    file: File,
    onProgress: (percent: number) => void
  ): Promise<string> => {
    const isStaticHost = window.location.hostname.includes("netlify.app") || window.location.hostname.includes("vercel.app") || window.location.hostname.includes("github.io");
    if (isStaticHost) {
      throw new Error("تنبيه هام للناشر: أنت الآن تستخدم نسخة مستضافة كبيئة ساكنة (Vercel / Netlify / GitHub). ميزة الرفع من الجهاز مباشرة تتطلب سيرفر نشط (Full-stack) مخصص. يرجى التغيير لاختيار 'رابط يوتيوب' للفيديو و'رابط مباشر خارجي' لملف الـ PDF لمشاركة المرفقات بشكل سليم بنسبة 100%!");
    }

    try {
      // For standard files under 35MB, use direct non-chunked single request upload.
      // This is extremely atomic, has 100% success rate on Cloud Run, and avoids multi-instance split-routing issues entirely!
      if (file.size <= 28 * 1024 * 1024) {
        const formDataBytes = new FormData();
        formDataBytes.append("file", file);
        
        const response = await fetch('/api/upload', {
          method: "POST",
          body: formDataBytes
        });
        
        if (response.ok) {
          const textResponse = await response.text();
          if (textResponse.trim().startsWith("<!doctype") || textResponse.trim().startsWith("<html")) {
            throw new Error("HTML_RESPONSE");
          }
          const data = JSON.parse(textResponse);
          onProgress(100);
          return data.url;
        }
        
        const errorText = await response.text();
        console.warn("Direct upload failed or was rejected, falling back to chunked upload. Error:", errorText);
      }
      
      // Chunked upload fallback for large files or if direct upload failed
      return await uploadFileInChunks(file, onProgress);
    } catch (err: any) {
      console.error("Upload error caught in uploadFile:", err);
      if (err.message === "HTML_RESPONSE" || err.message?.includes("Unexpected token '<'") || err.message?.includes("is not valid JSON") || err.message?.includes("Failed to fetch") || err.message?.includes("fetch")) {
        throw new Error("تنبيه هام للناشر: فشل العثور على خادم ملفات نشط للرفع. إذا كنت قمت بالرفع على استضافة Netlify، قم باختيار 'رابط يوتيوب' للفيديو و'رابط مباشر' لمرفقات الـ PDF لتفادي عدم توفر خادم رفع الملفات!");
      }
      throw err;
    }
  };

  const addModule = () => {
    const newModule: CourseModule = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'قسم جديد',
      items: []
    };
    onChange([...modules, newModule]);
  };

  const updateModule = (moduleId: string, title: string) => {
    onChange(modules.map(m => m.id === moduleId ? { ...m, title } : m));
  };

  const removeModule = (moduleId: string) => {
    onChange(modules.filter(m => m.id !== moduleId));
  };

  const addItem = (moduleId: string, type: 'lesson' | 'quiz') => {
    const newItem: CourseItem = type === 'lesson' 
      ? { type: 'lesson', id: Math.random().toString(36).substr(2, 9), title: 'درس جديد', content: '' }
      : { type: 'quiz', id: Math.random().toString(36).substr(2, 9), title: 'اختبار جديد', questions: [] };
    
    onChange(modules.map(m => m.id === moduleId ? { ...m, items: [...m.items, newItem] } : m));
  };

  const updateItem = (moduleId: string, itemId: string, updates: Partial<CourseItem>) => {
    onChange(modules.map(m => {
      if (m.id !== moduleId) return m;
      return {
        ...m,
        items: m.items.map(item => item.id === itemId ? { ...item, ...updates } as any : item)
      };
    }));
  };

  const removeItem = (moduleId: string, itemId: string) => {
    onChange(modules.map(m => m.id === moduleId ? { ...m, items: m.items.filter(i => i.id !== itemId) } : m));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">منهج الكورس</h3>
        <Button type="button" onClick={addModule} size="sm" variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
          <Plus className="ml-1 h-4 w-4" /> إضافة قسم جديد
        </Button>
      </div>

      <div className="space-y-4">
        {modules.map((module, mIdx) => (
          <Card key={module.id} className="border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50 p-4 flex items-center gap-3 border-b border-slate-100">
              <GripVertical className="h-4 w-4 text-slate-300 cursor-grab" />
              <div className="flex-1">
                <Input 
                  value={module.title} 
                  onChange={e => updateModule(module.id, e.target.value)}
                  className="bg-transparent border-none font-bold h-8 focus-visible:ring-0 px-0 text-slate-800"
                  placeholder="اسم القسم (مثال: الوحدة الأولى: الدوال)" 
                />
              </div>
              <Button type="button" onClick={() => removeModule(module.id)} size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <CardContent className="p-4 space-y-3">
              {module.items.length > 0 ? (
                <div className="space-y-2">
                  {module.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 group hover:border-indigo-200 transition-colors">
                      <div className="flex items-center gap-3">
                        {item.type === 'lesson' ? <Video className="h-4 w-4 text-indigo-500" /> : <ListTodo className="h-4 w-4 text-orange-500" />}
                        <Input 
                          value={item.title} 
                          onChange={e => updateItem(module.id, item.id, { title: e.target.value })}
                          className="bg-transparent border-none text-sm h-8 focus-visible:ring-0 p-0 w-48 font-medium" 
                          placeholder={item.type === 'lesson' ? "عنوان الدرس" : "عنوان الاختبار"}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger render={<Button type="button" size="sm" variant="secondary" className="text-xs px-4 h-8 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg" />}>
                            <HelpCircle className="ml-1 h-3 w-3" /> تعديل المحتوى
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl text-right p-0 flex flex-col max-h-[95vh] sm:max-h-[85vh]">
                            <DialogHeader className="p-6 border-b shrink-0">
                              <DialogTitle>{item.type === 'lesson' ? 'تعديل محتوى الدرس' : 'تعديل أسئلة الاختبار'}</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">العنوان الظاهر للطلاب</label>
                                <Input value={item.title} onChange={e => updateItem(module.id, item.id, { title: e.target.value })} />
                              </div>
                              {item.type === 'lesson' ? (
                                <>
                                  <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700">مصدر الفيديو</label>
                                    <Tabs 
                                      value={(item as Lesson).videoSource || 'url'} 
                                      onValueChange={val => updateItem(module.id, item.id, { videoSource: val as 'url' | 'file' })}
                                      className="w-full"
                                    >
                                      <TabsList className="grid grid-cols-2 bg-slate-100 rounded-xl">
                                        <TabsTrigger value="url" className="rounded-lg text-xs">رابط يوتيوب</TabsTrigger>
                                        <TabsTrigger value="file" className="rounded-lg text-xs">ملف من الكمبيوتر</TabsTrigger>
                                      </TabsList>
                                    </Tabs>
                                  </div>

                                  <div className="space-y-2">
                                    {((item as Lesson).videoSource || 'url') === 'url' ? (
                                      <>
                                        <label className="text-sm font-medium">رابط فيديو الشرح</label>
                                        <Input 
                                          placeholder="أدخل رابط فيديو من يوتيوب" 
                                          value={(item as Lesson).videoUrl || ''} 
                                          onChange={e => updateItem(module.id, item.id, { videoUrl: e.target.value })} 
                                        />
                                        <p className="text-[10px] text-zinc-400">يدعم روابط يوتيوب الرسمية</p>
                                      </>
                                    ) : (
                                      <div className="space-y-3">
                                        <label className="text-sm font-medium">تحميل ملف فيديو</label>
                                        <div className="flex flex-col gap-2 p-4 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50 text-center">
                                          {uploadingItemIds[`video-${item.id}`] ? (
                                            <div className="flex flex-col items-center justify-center gap-2 py-8">
                                              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                                              <span className="text-xs text-slate-500 font-bold">جاري رفع ملف الفيديو...</span>
                                              <div className="w-full max-w-xs bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                                                <div 
                                                  className="bg-indigo-600 h-full transition-all duration-300" 
                                                  style={{ width: `${uploadProgress[`video-${item.id}`] || 0}%` }}
                                                />
                                              </div>
                                              <span className="text-[10px] text-indigo-600 font-black">{uploadProgress[`video-${item.id}`] || 0}%</span>
                                            </div>
                                          ) : ((item as Lesson).videoUrl?.startsWith('/uploads/') || (item as Lesson).videoUrl?.startsWith('data:video')) ? (
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 text-xs font-bold">
                                                <CheckCircle className="h-3 w-3" /> تم رفع الملف بنجاح
                                              </div>
                                              <div className="relative group rounded-xl overflow-hidden shadow-inner bg-black aspect-video flex items-center justify-center">
                                                <video src={(item as Lesson).videoUrl} className="max-h-full max-w-full" controls />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                  <Button 
                                                    type="button" 
                                                    variant="destructive" 
                                                    size="sm" 
                                                    onClick={() => updateItem(module.id, item.id, { videoUrl: '' })}
                                                    className="h-8 rounded-lg shadow-lg"
                                                  >
                                                    <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف والرفع مجدداً
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="py-4">
                                              <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <FileUp className="h-5 w-5 text-slate-400" />
                                              </div>
                                              <div className="text-xs text-slate-500 mb-1 font-medium">يمكنك اختيار ملف فيديو بمساحة تصل إلى 150 ميجابايت</div>
                                              <div className="text-[10px] text-indigo-500 font-medium">سيتم تقسيم الفيديو تلقائياً ورفعه لتجنب مشاكل الاتصال والسرعات الضعيفة</div>
                                            </div>
                                          )}
                                          <Input 
                                            type="file" 
                                            accept="video/mp4,video/webm,video/ogg" 
                                            className="hidden" 
                                            id={`video-upload-${item.id}`}
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                if (file.size > 150 * 1024 * 1024) {
                                                  toast.error("الملف كبير جداً. الحد الأقصى للفيديوهات هو 150 ميجابايت.");
                                                  return;
                                                }
                                                
                                                setUploadingItemIds(prev => ({ ...prev, [`video-${item.id}`]: true }));
                                                setUploadProgress(prev => ({ ...prev, [`video-${item.id}`]: 0 }));
                                                
                                                try {
                                                  const uploadedUrl = await uploadFile(file, (percent) => {
                                                    setUploadProgress(prev => ({ ...prev, [`video-${item.id}`]: percent }));
                                                  });
                                                  updateItem(module.id, item.id, { videoUrl: uploadedUrl });
                                                  toast.success("تم رفع الفيديو بنجاح على السيرفر");
                                                } catch (err: any) {
                                                  console.error("Video Upload catch error:", err);
                                                  toast.error(err.message || "حدث خطأ في الاتصال أو الحجم أثناء رفع الفيديو.");
                                                } finally {
                                                  setUploadingItemIds(prev => ({ ...prev, [`video-${item.id}`]: false }));
                                                }
                                              }
                                            }}
                                          />
                                          {!((item as Lesson).videoUrl?.startsWith('/uploads/') || (item as Lesson).videoUrl?.startsWith('data:video')) && !uploadingItemIds[`video-${item.id}`] && (
                                            <Button 
                                              type="button" 
                                              variant="outline" 
                                              onClick={() => document.getElementById(`video-upload-${item.id}`)?.click()}
                                              className="mx-auto rounded-xl border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
                                            >
                                              <FileUp className="ml-2 h-4 w-4" /> اختر ملف الفيديو
                                             </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">الملخص النصي أو الملاحظات</label>
                                    <textarea 
                                      className="flex min-h-[160px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      value={(item as Lesson).content || ''} 
                                      onChange={e => updateItem(module.id, item.id, { content: e.target.value })} 
                                      placeholder="يمكنك كتابة شرح الدرس هنا..."
                                    />
                                  </div>

                                  <div className="space-y-4 border-t pt-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <label className="text-sm font-bold text-slate-700 block text-right">ملفات ومرفقات الدرس (PDF)</label>
                                      <Tabs 
                                        value={(item as Lesson).pdfSource || 'file'} 
                                        onValueChange={val => updateItem(module.id, item.id, { pdfSource: val as 'url' | 'file' })}
                                        className="w-full sm:w-60"
                                      >
                                        <TabsList className="grid grid-cols-2 bg-slate-100 rounded-xl">
                                          <TabsTrigger value="file" className="rounded-lg text-xs">ملف من جهازك</TabsTrigger>
                                          <TabsTrigger value="url" className="rounded-lg text-xs">رابط مباشر</TabsTrigger>
                                        </TabsList>
                                      </Tabs>
                                    </div>

                                    {((item as Lesson).pdfSource || 'file') === 'url' ? (
                                      <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50">
                                        <div className="space-y-1.5 text-right">
                                          <label className="text-xs font-semibold text-slate-600">رابط ملف الـ PDF المباشر</label>
                                          <Input 
                                            placeholder="مثال: https://link-to-your-pdf-file.pdf" 
                                            value={(item as Lesson).pdfUrl || ''} 
                                            onChange={e => updateItem(module.id, item.id, { pdfUrl: e.target.value, pdfName: (item as Lesson).pdfName || 'مرفق الدرس (PDF)' })} 
                                            dir="ltr"
                                            className="text-left"
                                          />
                                        </div>
                                        <div className="space-y-1.5 text-right">
                                          <label className="text-xs font-semibold text-slate-600">اسم المرفق</label>
                                          <Input 
                                            placeholder="مثال: مذكرة شرح الجبر" 
                                            value={(item as Lesson).pdfName || ''} 
                                            onChange={e => updateItem(module.id, item.id, { pdfName: e.target.value })} 
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2 p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
                                        {(item as Lesson).pdfUrl ? (
                                          <div className="space-y-3">
                                            <div className="flex items-center justify-between bg-indigo-50/60 text-indigo-700 px-3 py-2 rounded-xl border border-indigo-100/50 text-xs font-bold flex-row-reverse">
                                              <div className="flex items-center gap-2 flex-row-reverse">
                                                <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                                                <span className="truncate max-w-[200px]" dir="ltr">{(item as Lesson).pdfName || 'attachment.pdf'}</span>
                                              </div>
                                              <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => updateItem(module.id, item.id, { pdfUrl: '', pdfName: '' })}
                                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="py-2">
                                            {uploadingItemIds[`pdf-${item.id}`] ? (
                                              <div className="flex flex-col items-center justify-center gap-2 py-4">
                                                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                                <span className="text-xs text-slate-500 font-bold">جاري رفع ملف الـ PDF...</span>
                                                <div className="w-full max-w-xs bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                                                  <div 
                                                    className="bg-indigo-600 h-full transition-all duration-300" 
                                                    style={{ width: `${uploadProgress[`pdf-${item.id}`] || 0}%` }}
                                                  />
                                                </div>
                                                <span className="text-[10px] text-indigo-600 font-bold">{uploadProgress[`pdf-${item.id}`] || 0}%</span>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                                  <FileUp className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <div className="text-xs text-slate-500 mb-2 font-medium">يمكنك اختيار ملف PDF من جهازك ومشاركته مع الطلاب</div>
                                                <Input 
                                                  type="file" 
                                                  accept="application/pdf" 
                                                  className="hidden" 
                                                  id={`pdf-upload-${item.id}`}
                                                  onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      setUploadingItemIds(prev => ({ ...prev, [`pdf-${item.id}`]: true }));
                                                      setUploadProgress(prev => ({ ...prev, [`pdf-${item.id}`]: 0 }));
                                                      try {
                                                        const uploadedUrl = await uploadFile(file, (percent) => {
                                                          setUploadProgress(prev => ({ ...prev, [`pdf-${item.id}`]: percent }));
                                                        });
                                                        updateItem(module.id, item.id, { pdfUrl: uploadedUrl, pdfName: file.name });
                                                        toast.success("تم رفع ملف الـ PDF بنجاح");
                                                      } catch (err: any) {
                                                        console.error("PDF upload error:", err);
                                                        toast.error(err.message || "حدث خطأ أثناء الاتصال بالسيرفر لرفع الملف. يرجى المحاولة مرة أخرى.");
                                                      } finally {
                                                        setUploadingItemIds(prev => ({ ...prev, [`pdf-${item.id}`]: false }));
                                                      }
                                                    }
                                                  }}
                                                />
                                                <Button 
                                                  type="button" 
                                                  variant="outline" 
                                                  onClick={() => document.getElementById(`pdf-upload-${item.id}`)?.click()}
                                                  className="mx-auto rounded-xl border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
                                                >
                                                  <Plus className="ml-1.5 h-3.5 w-3.5" /> اختر ملف PDF
                                                </Button>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-6">
                                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <label className="text-sm font-bold text-slate-700 block text-right">طريقة إنشاء الاختبار</label>
                                    <Tabs 
                                      value={(item as Quiz).embedCode !== undefined ? 'embed' : 'questions'} 
                                      onValueChange={val => {
                                        if (val === 'embed') {
                                          updateItem(module.id, item.id, { embedCode: (item as Quiz).embedCode || '' });
                                        } else {
                                          const itemCopy = { ...item };
                                          delete (itemCopy as any).embedCode;
                                          updateItem(module.id, item.id, itemCopy);
                                        }
                                      }}
                                      className="w-full"
                                    >
                                      <TabsList className="grid grid-cols-2 bg-slate-200 rounded-lg p-1">
                                        <TabsTrigger value="questions" className="rounded-md text-xs py-1.5">أسئلة تفاعلية (يدوية)</TabsTrigger>
                                        <TabsTrigger value="embed" className="rounded-md text-xs py-1.5">تضمين كود HTML / استمارة خارجية</TabsTrigger>
                                      </TabsList>
                                    </Tabs>
                                  </div>

                                  {(item as Quiz).embedCode !== undefined ? (
                                    <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                                      <div className="flex justify-between items-center flex-row-reverse">
                                        <label className="text-sm font-bold text-indigo-900 block text-right">كود HTML / Iframe للتضمين</label>
                                        <Badge className="bg-indigo-100 text-indigo-700 border-none rounded-lg">تضمين خارجي</Badge>
                                      </div>
                                      <textarea 
                                        className="font-mono text-xs flex min-h-[150px] w-full rounded-xl border border-slate-200 bg-white p-3 text-left focus-visible:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={(item as Quiz).embedCode || ''} 
                                        onChange={e => updateItem(module.id, item.id, { embedCode: e.target.value })} 
                                        placeholder="<iframe src='https://docs.google.com/forms/d/.../viewform?embedded=true' width='100%' height='600'>جاري التحميل...</iframe>"
                                        dir="ltr"
                                      />
                                      <div className="space-y-1 text-right">
                                        <p className="text-[11px] text-slate-500 font-medium">* الصق هنا كود التضمين الخاص بالاختبار من Google Forms أو Microsoft Forms أو Canva أو Quizizz أو Wordwall.</p>
                                        <p className="text-[11px] text-indigo-600 font-bold">* سيظهر هذا النموذج مباشرة للطلاب في صفحة تشغيل الكورس.</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="pt-1">
                                      <QuizBuilder 
                                        questions={(item as Quiz).questions} 
                                        onChange={(questions) => updateItem(module.id, item.id, { questions })} 
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="p-4 border-t bg-slate-50 shrink-0">
                               {item.type === 'lesson' ? (
                                 <DialogClose render={<Button onClick={() => toast.info("تم حفظ محتوى الدرس مؤقتاً")} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-6 font-bold text-lg" />}>
                                   حفظ محتوى الدرس والرجوع
                                 </DialogClose>
                               ) : (
                                 <DialogClose render={<Button onClick={() => toast.success("تم حفظ الأسئلة بنجاح")} className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-6 font-bold text-lg" />}>
                                   حفظ جميع الأسئلة والرجوع
                                 </DialogClose>
                               )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button type="button" onClick={() => removeItem(module.id, item.id)} size="icon" variant="ghost" className="h-8 w-8 text-slate-200 hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center border border-dashed border-slate-100 rounded-xl">
                  <p className="text-xs text-slate-400">هذا القسم فارغ، أضف أول درس أو اختبار</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" onClick={() => addItem(module.id, 'lesson')} size="sm" variant="ghost" className="text-xs text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 flex-1 h-9 rounded-lg">
                  <Plus className="ml-1 h-3 w-3" /> إضافة درس فيديو
                </Button>
                <Button type="button" onClick={() => addItem(module.id, 'quiz')} size="sm" variant="ghost" className="text-xs text-orange-600 bg-orange-50/50 hover:bg-orange-100 flex-1 h-9 rounded-lg">
                  <Plus className="ml-1 h-3 w-3" /> إضافة اختبار سريع
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {modules.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/30">
            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
               <Plus className="h-8 w-8 text-slate-200" />
            </div>
            <p className="text-slate-500 font-medium mb-4">لم تقم بتقسيم المنهج بعد</p>
            <Button type="button" onClick={addModule} variant="outline" className="rounded-xl border-indigo-200 text-indigo-600">
               ابدأ بإضافة أول قسم للمنهج
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const QuizBuilder = ({ questions, onChange }: { questions: Question[], onChange: (q: Question[]) => void }) => {
  const addQuestion = () => {
    const newQ: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'سؤال جديد؟',
      options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
      correctAnswerIndex: 0
    };
    onChange([...questions, newQ]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter(q => q.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">الأسئلة</label>
        <Button type="button" onClick={addQuestion} size="sm" variant="outline" className="border-orange-200 text-orange-700 bg-orange-50 h-8">
          <Plus className="ml-1 h-3 w-3" /> إضافة سؤال يدوي
        </Button>
      </div>
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="p-4 border border-slate-100 rounded-xl space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">سؤال {idx + 1}</span>
              <Button type="button" onClick={() => removeQuestion(q.id)} size="icon" variant="ghost" className="h-6 w-6 text-slate-300 hover:text-red-500">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Input value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} placeholder="نص السؤال" />
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt, optIdx) => (
                <div key={optIdx} className="flex gap-2">
                   <Input 
                    value={opt} 
                    onChange={e => {
                      const newOpts = [...q.options];
                      newOpts[optIdx] = e.target.value;
                      updateQuestion(q.id, { options: newOpts });
                    }} 
                    className={`text-xs ${q.correctAnswerIndex === optIdx ? 'border-emerald-500 bg-emerald-50' : ''}`}
                  />
                  <input 
                    type="radio" 
                    name={`correct-${q.id}`} 
                    checked={q.correctAnswerIndex === optIdx} 
                    onChange={() => updateQuestion(q.id, { correctAnswerIndex: optIdx })}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper to get YouTube embed URL correctly
const getYouTubeEmbedUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('youtube.com/embed/')) return url;
  
  try {
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
    } else if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(new URL(url).search);
      videoId = urlParams.get('v') || '';
    } else if (url.includes('youtube.com/v/')) {
      videoId = url.split('youtube.com/v/')[1]?.split(/[?#]/)[0];
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  } catch (e) {
    return url;
  }
};

// ================= QUIZ EMBED RENDERER =================
const QuizEmbedRenderer = ({ embedCode }: { embedCode: string }) => {
  const code = (embedCode || '').trim();
  
  // If it's a simple iframe without any scripts and starts with '<iframe', render it directly
  const isSimpleIframe = code.toLowerCase().startsWith('<iframe') && !code.toLowerCase().includes('<script');

  if (isSimpleIframe) {
    return (
      <div 
        className="w-full min-h-[600px] flex items-stretch justify-stretch [&_iframe]:w-full [&_iframe]:min-h-[600px] [&_iframe]:border-none [&_iframe]:rounded-xl"
        dangerouslySetInnerHTML={{ __html: code }}
      />
    );
  }

  // Check if it is already a full HTML page
  const hasFullHtmlWrapper = code.toLowerCase().includes('<!doctype') || 
                             code.toLowerCase().includes('<html') || 
                             code.toLowerCase().includes('<body');

  // Otherwise, it is HTML code with potential script tags, styling, etc.
  // We wrap it in a micro HTML5 wrapper to allow local JS execution.
  // We also inject a viewport meta tag for excellent mobile responsiveness.
  const responsiveHtml = hasFullHtmlWrapper ? code : `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl font-sans">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
      <title>الاختبار</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 16px;
          color: #1e293b;
          background-color: #f8fafc;
          direction: rtl;
          text-align: right;
          box-sizing: border-box;
          -webkit-text-size-adjust: 100%;
        }
        * {
          box-sizing: border-box;
          max-width: 100%;
        }
        /* Style standard buttons and form fields beautifully */
        button, input[type="button"], input[type="submit"] {
          font-family: inherit;
          cursor: pointer;
        }
        button:active, input[type="button"]:active {
          transform: scale(0.98);
        }
      </style>
    </head>
    <body>
      ${code}
    </body>
    </html>
  `;

  return (
    <iframe
      srcDoc={responsiveHtml}
      className="w-full min-h-[600px] border-none rounded-2xl bg-slate-50 shadow-inner"
      title="محتوى الاختبار"
    />
  );
};

// ================= COURSE PLAYER =================
const CoursePlayer = ({ course, enrollment, currentUser }: { course: Course, enrollment?: any, currentUser: UserProfile | null }) => {
  const [activeItem, setActiveItem] = useState<CourseItem | null>(null);
  const [quizState, setQuizState] = useState<{ [qId: string]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certName, setCertName] = useState('');

  useEffect(() => {
    if (currentUser) {
      setCertName(currentUser.displayName || currentUser.email.split('@')[0] || '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (course.content?.length > 0 && course.content[0].items.length > 0) {
      setActiveItem(course.content[0].items[0]);
    }
  }, [course]);

  if (!course.content || course.content.length === 0) {
    return (
      <div className="py-20 text-center">
        <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-400">هذا الكورس لا يحتوي على دروس بعد.</h3>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8 min-h-[600px]">
      {/* Dynamic Content Area */}
      <div className="lg:col-span-2 space-y-6">
        {activeItem ? (
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardContent className="p-0">
              {activeItem.type === 'lesson' ? (
                <div className="space-y-6">
                  {activeItem.videoUrl && (
                    <div className="aspect-video bg-black relative group rounded-t-3xl overflow-hidden">
                      {(activeItem as Lesson).videoSource === 'file' || activeItem.videoUrl.startsWith('data:video') || activeItem.videoUrl.startsWith('/uploads/') ? (
                        <video 
                          className="w-full h-full" 
                          controls 
                          src={activeItem.videoUrl} 
                        />
                      ) : (
                        <iframe 
                          className="w-full h-full"
                          src={getYouTubeEmbedUrl(activeItem.videoUrl)} 
                          frameBorder="0" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                          allowFullScreen
                        />
                      )}
                    </div>
                  )}
                  <div className="p-8 text-right">
                    <h2 className="text-3xl font-black mb-6 border-b pb-4">{activeItem.title}</h2>
                    <div className="prose prose-slate max-w-none">
                      <Markdown>{activeItem.content || ''}</Markdown>
                    </div>

                    {(activeItem as Lesson).pdfUrl && (
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 block text-right">الملفات المرفقة بالدرس:</h4>
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex-row-reverse">
                          <div className="flex items-center gap-3 flex-row-reverse">
                            <div className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-800">{(activeItem as Lesson).pdfName || 'مرفق الدرس (PDF)'}</p>
                              <p className="text-[10px] text-slate-500 font-medium">ملف بصيغة PDF للقراءة والتحميل</p>
                            </div>
                          </div>
                          <a 
                            href={(activeItem as Lesson).pdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors w-full sm:w-auto"
                          >
                            عرض وتحميل الملف <FileText className="mr-1.5 h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-right space-y-8">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h2 className="text-3xl font-black">{activeItem.title}</h2>
                    <Badge className="bg-orange-600 text-white">اختبار</Badge>
                  </div>
                  
                  {(activeItem as Quiz).embedCode !== undefined ? (
                    <div className="space-y-4 text-right">
                      <QuizEmbedRenderer embedCode={(activeItem as Quiz).embedCode || ''} />
                      <div className="p-4 bg-indigo-50 border border-indigo-100/30 rounded-xl text-indigo-800 text-xs text-right font-medium flex flex-col sm:flex-row-reverse items-center justify-between gap-4">
                        <span>تنبيه: يتطلب هذا الاختبار الاتصال بالإنترنت لعرض وإرسال الإجابات عبر الاستمارة المضمنة أعلاه.</span>
                        <Button 
                          onClick={() => setShowCertificate(true)} 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-10 px-5 shadow-sm text-xs shrink-0 flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> أكملت الاختبار الخارجي! إصدار الشهادة
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-10">
                        {activeItem.questions.map((q, idx) => (
                          <div key={q.id} className="space-y-4">
                            <h4 className="text-lg font-bold flex gap-3 flex-row-reverse text-right">
                              <span className="text-indigo-600">.{idx + 1}</span>
                              {q.text}
                            </h4>
                            <div className="grid gap-3">
                              {q.options.map((opt, optIdx) => {
                                const isSelected = quizState[q.id] === optIdx;
                                const isCorrect = optIdx === q.correctAnswerIndex;
                                
                                let btnClasses = "border-slate-100 bg-slate-50/50 hover:bg-slate-100 text-slate-700";
                                if (quizSubmitted) {
                                  if (isCorrect) {
                                    btnClasses = "border-emerald-500 bg-emerald-50 text-emerald-930 font-bold ring-2 ring-emerald-100";
                                  } else if (isSelected) {
                                    btnClasses = "border-rose-500 bg-rose-50 text-rose-930 font-bold ring-2 ring-rose-100";
                                  } else {
                                    btnClasses = "border-slate-100 bg-slate-50/20 text-slate-400 opacity-60";
                                  }
                                } else if (isSelected) {
                                  btnClasses = "border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200 font-bold";
                                }
                                
                                return (
                                  <button
                                    key={optIdx}
                                    disabled={quizSubmitted}
                                    onClick={() => setQuizState({ ...quizState, [q.id]: optIdx })}
                                    className={`text-right p-4 rounded-xl border-2 transition-all w-full flex items-center justify-between gap-4 ${btnClasses}`}
                                  >
                                    <span className="text-sm font-medium">{opt}</span>
                                    {quizSubmitted && isCorrect && (
                                      <span className="text-[10px] text-emerald-700 font-black bg-emerald-100/80 px-2.5 py-1 rounded-md shrink-0">الإجابة الصحيحة ✓</span>
                                    )}
                                    {quizSubmitted && isSelected && !isCorrect && (
                                      <span className="text-[10px] text-rose-700 font-black bg-rose-100/80 px-2.5 py-1 rounded-md shrink-0">إجابتك الخاطئة ✗</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!quizSubmitted && activeItem.questions.length > 0 && (
                        <Button 
                          onClick={() => setQuizSubmitted(true)}
                          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-xl font-bold rounded-2xl shadow-lg mt-8"
                        >
                          تسليم الإجابات
                        </Button>
                      )}

                      {quizSubmitted && (
                        <div className="p-6 bg-emerald-50/40 rounded-2xl text-emerald-900 border-2 border-emerald-100/50 animate-in zoom-in duration-300 space-y-4 text-right">
                          <div className="flex items-center gap-3 flex-row-reverse">
                            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                              <GraduationCap className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold">تم إنهاء وتأكيد تسليم الاختبار بنجاح!</h4>
                              <p className="text-xs text-emerald-700 font-medium">تم تقييم إجاباتك ورصد نتيجتك فوراً</p>
                            </div>
                          </div>
                          
                          <p className="text-sm">
                            لقد أجبت بشكل صحيح على <strong className="text-emerald-700 text-base">{
                              Object.keys(quizState).filter(qId => {
                                const q = activeItem.questions.find(quest => quest.id === qId);
                                return q && quizState[qId] === q.correctAnswerIndex;
                              }).length
                            }</strong> من أصل <strong className="text-slate-700">{activeItem.questions.length}</strong> أسئلة.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button 
                              onClick={() => setShowCertificate(true)} 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 px-5 shadow-md flex-1 flex items-center justify-center gap-1.5"
                            >
                              <Sparkles className="h-4 w-4" /> إنهاء الكورس وجلب الشهادة
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-100 bg-white h-11 px-4 rounded-xl font-bold" 
                              onClick={() => { setQuizSubmitted(false); setQuizState({}); }}
                            >
                              إعادة الاختبار
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl shadow-sm border border-slate-100">
            <PlayCircle className="h-16 w-16 text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold">يرجى اختيار درس للبدء</p>
          </div>
        )}
      </div>

      {/* Certificate of Excellence Dialog Modal */}
      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className="max-w-4xl p-6 bg-slate-50 border-none rounded-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-800 flex items-center gap-2 justify-end">
              <span>إصدار شهادتك الرسمية</span>
              <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col md:flex-row-reverse items-center gap-4 text-right">
              <div className="flex-1 w-full space-y-1.5">
                <Label htmlFor="cert-owner-name" className="font-bold text-slate-700 text-sm">اسمك الكامل كما تحب أن يظهر في الشهادة:</Label>
                <Input 
                  id="cert-owner-name"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله الهاشمي"
                  className="rounded-xl border-slate-200 text-right font-bold focus:ring-2 focus:ring-indigo-500 h-11"
                />
              </div>
              <div className="shrink-0 w-full md:w-auto">
                <Button 
                  onClick={() => window.print()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-11 px-6 shadow-md flex items-center justify-center gap-2"
                >
                  <FileText className="h-5 w-5" /> طباعة أو حفظ الشهادة PDF
                </Button>
              </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #certificate-printable-area, #certificate-printable-area * {
                  visibility: visible !important;
                }
                #certificate-printable-area {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  background: white !important;
                  z-index: 999999 !important;
                  box-sizing: border-box !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />

            <div 
              id="certificate-printable-area" 
              className="relative p-8 md:p-14 bg-amber-50/20 border-[16px] border-amber-900/10 rounded-3xl text-center font-sans select-none overflow-hidden"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(217, 119, 6, 0.03) 10%, transparent 10.01%)',
                backgroundSize: '12px 12px'
              }}
            >
              <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-amber-600 rounded-tl-xl" />
              <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-amber-600 rounded-tr-xl" />
              <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-amber-600 rounded-bl-xl" />
              <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-amber-600 rounded-br-xl" />

              <div className="absolute inset-5 border border-amber-600/30 rounded-2xl pointer-events-none" />
              <div className="absolute inset-6 border border-amber-600/20 rounded-2xl pointer-events-none" />

              <div className="space-y-6 max-w-2xl mx-auto py-2">
                <div className="space-y-2 flex flex-col items-center">
                  <div className="h-16 w-16 bg-amber-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-200">
                    <GraduationCap className="h-9 w-9" />
                  </div>
                  <h1 className="text-xs font-black tracking-widest text-amber-600 uppercase">شهادة نجاح وتفوق رسمية</h1>
                </div>

                <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight">شهادة إتمام كورس</h2>
                
                <p className="text-slate-500 font-medium max-w-md mx-auto text-sm leading-relaxed">
                  تمنح إدارة المنصة التعليمية هذه الشهادة بكل فخر واعتزاز إلى الطالب/الطالبة المتميز:
                </p>

                <div className="py-3 border-b-2 border-dashed border-amber-600/20 max-w-lg mx-auto">
                  <h3 className="text-2xl md:text-4xl font-black text-indigo-900 tracking-wide font-sans">{certName || 'طالب متميز'}</h3>
                </div>

                <p className="text-slate-500 font-medium max-w-lg mx-auto text-sm leading-relaxed">
                  وذلك تقديراً لاجتيازه وتفوقه في كافة اختبارات ومتطلبات كورس المنهج الدراسي بنجاح:
                </p>

                <div className="my-2 p-4 bg-amber-600/5 border border-amber-600/10 rounded-2xl max-w-xl mx-auto">
                  <h4 className="text-lg md:text-2xl font-black text-amber-900">{course.title}</h4>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-100 text-right max-w-xl mx-auto">
                  <div>
                    <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wider mb-2 text-right">توقيع مدرس المساق</span>
                    <span className="text-sm font-black text-slate-800 font-serif leading-none italic block text-right">{course.teacherName}</span>
                    <div className="mt-1 border-t border-slate-200 w-28 mr-auto" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wider mb-2 text-left">تأكيد إدارة المنصة</span>
                    <span className="text-sm font-black text-emerald-700 font-serif block text-left">منصة التميز التعليمية</span>
                    <div className="mt-1 border-t border-slate-200 w-28 ml-auto" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider font-extrabold max-w-xl mx-auto text-right">
                  <span>كود التحقق الرقمي: <code className="text-slate-700 bg-slate-100 px-2 py-1 rounded font-mono select-all">CERT-{course.id.substring(0,6).toUpperCase()}-{currentUser?.uid?.substring(0,6).toUpperCase() || 'GUEST'}</code></span>
                  <span>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 no-print">
              <Button onClick={() => setShowCertificate(false)} variant="ghost" className="rounded-xl border font-bold text-slate-500">
                إغلاق النافذة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Curriculum Sidebar */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-right px-2">محتوى الكورس</h3>
        <div className="space-y-4">
          {course.content.map((module) => (
            <div key={module.id} className="space-y-2">
              <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-100 text-right">
                <span className="text-sm font-black text-slate-900">{module.title}</span>
              </div>
              <div className="space-y-1 pr-4 border-r-2 border-slate-100 mr-2">
                {module.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveItem(item);
                      setQuizSubmitted(false);
                      setQuizState({});
                    }}
                    className={`w-full text-right p-3 rounded-xl flex items-center justify-between transition-all group ${
                      activeItem?.id === item.id 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.type === 'lesson' ? <Video className="h-4 w-4 opacity-70" /> : <ListTodo className="h-4 w-4 opacity-70" />}
                      <span className="text-sm font-medium">{item.title}</span>
                    </div>
                    {activeItem?.id === item.id && <div className="h-2 w-2 rounded-full bg-white animate-pulse" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
// ================= CURRICULUM PREVIEW (READ ONLY) =================
const CurriculumPreview = ({ modules }: { modules: CourseModule[] }) => {
  return (
    <div className="space-y-4 text-right">
      {modules.map((module) => (
        <div key={module.id} className="space-y-2">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-bold text-sm">
            {module.title}
          </div>
          <div className="space-y-1 pr-4 border-r-2 border-slate-100 mr-2">
            {module.items.map((item) => (
              <div key={item.id} className="p-2 text-xs flex items-center gap-2 text-slate-600">
                {item.type === 'lesson' ? <Video className="h-3 w-3" /> : <ListTodo className="h-3 w-3" />}
                {item.title}
              </div>
            ))}
            {module.items.length === 0 && <span className="text-[10px] text-slate-400">لا توجد دروس بعد</span>}
          </div>
        </div>
      ))}
      {modules.length === 0 && <p className="text-center text-slate-400 text-sm py-4">لم يتم إضافة محتوى بعد</p>}
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [aiOpen, setAiOpen] = useState(false);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [aiChat, setAiChat] = useState<{ role: string; parts: { text: string }[] }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");

  const [authLoading, setAuthLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [pendingTeachers, setPendingTeachers] = useState<UserProfile[]>([]);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isActiveForEveryone, setIsActiveForEveryone] = useState(false);

  // States for custom deletion confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for unified Auth Modal (Google & Email/Password for external hosting support)
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoadingState, setAuthLoadingState] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setAuthLoadingState(true);
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      toast.success("تم تسجيل الدخول بنجاح!");
      setAuthModalOpen(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || "";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || errMsg.includes("invalid-credential")) {
        toast.error("خطأ في البريد الإلكتروني أو كلمة المرور");
      } else if (err.code === "auth/invalid-email") {
        toast.error("صيغة البريد الإلكتروني غير صحيحة");
      } else {
        toast.error(`فشل تسجيل الدخول: ${err.message}`);
      }
    } finally {
      setAuthLoadingState(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authName) {
      toast.error("يرجى ملء جميع الحقول المطلوبة بما في ذلك الاسم");
      return;
    }
    if (authPassword.length < 6) {
      toast.error("يجب أن تكون كلمة المرور 6 أحرف على الأقل");
      return;
    }
    setAuthLoadingState(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      await updateProfile(userCredential.user, {
        displayName: authName
      });
      
      const isAdmin = authEmail.trim().toLowerCase() === MASTER_ADMIN_EMAIL.trim().toLowerCase();
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: authEmail,
        role: isAdmin ? 'admin' : 'student',
        displayName: authName,
        balance: 0,
        status: 'approved',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
      
      toast.success("تم إنشاء الحساب وتسجيل الدخول بنجاح!");
      setAuthModalOpen(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        toast.error("هذا البريد الإلكتروني مستخدم بالفعل");
      } else if (err.code === "auth/invalid-email") {
        toast.error("صيغة البريد الإلكتروني غير صحيحة");
      } else if (err.code === "auth/weak-password") {
        toast.error("كلمة المرور ضعيفة للغاية");
      } else {
        toast.error(`فشل إنشاء الحساب: ${err.message}`);
      }
    } finally {
      setAuthLoadingState(false);
    }
  };

  // Set global admin flag for Gemini helper
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__IS_ADMIN_USER__ = currentUser?.role === 'admin';
    }
  }, [currentUser]);

  // Check Database Connection on Mount
  useEffect(() => {
    // Load Global AI Config
    const loadConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'app_settings', 'ai_config'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          const key = data.gemini_key;
          const active = data.isActiveForEveryone || false;
          setIsActiveForEveryone(active);
          if (key) setGlobalApiKey(key, active);
        }
      } catch (e) {
        console.error("Failed to load global AI config", e);
      }
    };
    loadConfig();

    const checkConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'system', 'ping'));
        setDbConnected(true);
      } catch (err: any) {
        // If it's just a "not found" error, it means we are connected but the doc doesn't exist (which is fine)
        if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
          setDbConnected(true);
        } else {
          console.error("Database connection check failed:", err);
          setDbConnected(false);
        }
      }
    };
    checkConnection();
  }, []);

  // Load Auth State
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      try {
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          
          // Real-time synchronization of the user profile document
          unsubscribeDoc = onSnapshot(userDocRef, async (snapshot) => {
            if (snapshot.exists()) {
              const profile = snapshot.data() as UserProfile;
              if (profile.email === MASTER_ADMIN_EMAIL && profile.role !== 'admin') {
                const updated = { ...profile, role: 'admin' as const, status: 'approved' as const };
                try {
                  await setDoc(userDocRef, updated, { merge: true });
                } catch (err) {
                  console.warn("Failed to upgrade admin role in Firestore:", err);
                }
                setCurrentUser(updated);
              } else {
                setCurrentUser(profile);
              }
              setAuthLoading(false);
            } else {
              // Create user document if it does not exist yet (e.g. Google Sign-in or email signup fallback)
              const isAdmin = user.email === MASTER_ADMIN_EMAIL;
              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                role: isAdmin ? 'admin' : 'student', 
                displayName: user.displayName || 'Anonymous',
                balance: 0,
                status: 'approved',
                createdAt: new Date().toISOString()
              };
              if (user.photoURL) {
                newProfile.photoURL = user.photoURL;
              }
              
              try {
                await setDoc(userDocRef, newProfile);
                setCurrentUser(newProfile);
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
                setCurrentUser(newProfile); // Fallback to local state
              }
              setAuthLoading(false);
            }
          }, (err) => {
            console.error("User profile snapshot error:", err);
            setAuthLoading(false);
          });
        } else {
          setCurrentUser(null);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Load Pending Teachers (Admin Only)
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    const q = query(collection(db, 'users'), where("status", "==", "pending"), where("role", "==", "teacher"));
    const path = 'users';
    return onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach(doc => list.push({ uid: doc.id, ...doc.data() } as UserProfile));
      setPendingTeachers(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));
  }, [currentUser]);

  // Load Courses
  useEffect(() => {
    const q = collection(db, 'courses');
    const path = 'courses';
    return onSnapshot(q, (snapshot) => {
      const list: Course[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Course));
      setCourses(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));
  }, []);

  // Load My Enrollments
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'enrollments'), where("userId", "==", currentUser.uid));
    const path = 'enrollments';
    return onSnapshot(q, (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach(doc => ids.push(doc.data().courseId));
      setMyEnrollments(ids);
    }, (err) => handleFirestoreError(err, OperationType.LIST, path));
  }, [currentUser]);

  const handlePaymentSuccess = async (courseId: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'enrollments'), {
        userId: currentUser.uid,
        courseId,
        enrolledAt: new Date().toISOString()
      });
      toast.success("تم الاشتراك بنجاح!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'enrollments');
    }
  };

  const askAi = async () => {
    if (!currentQuestion.trim()) return;
    const newChat = [...aiChat, { role: "user", parts: [{ text: currentQuestion }] }];
    setAiChat(newChat);
    setCurrentQuestion("");
    try {
      const answer = await getMathTutorResponse(currentQuestion, aiChat);
      setAiChat([...newChat, { role: "model", parts: [{ text: answer || '' }] }]);
    } catch (err) {
      toast.error("فشل الذكاء الاصطناعي في الرد. تحقق من مفتاح API.");
    }
  };

  const updateCourseStatus = async (courseId: string, status: 'approved' | 'rejected') => {
    try {
      await setDoc(doc(db, 'courses', courseId), { status }, { merge: true });
      toast.success(status === 'approved' ? "تم قبول الكورس بنجاح" : "تم رفض الكورس");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
    }
  };

  const updateUserRole = async (userId: string, role: 'teacher' | 'student', status: 'approved' | 'rejected' | 'pending') => {
    try {
      await setDoc(doc(db, 'users', userId), { role, status }, { merge: true });
      toast.success("تم تحديث حالة المستخدم");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const applyToBeTeacher = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { status: 'pending', role: 'teacher' }, { merge: true });
      toast.success("تم إرسال طلب الانضمام كمدرس. سيتم مراجعته من قبل الإدارة.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const initiateCourseDeletion = (courseId: string, courseTitle: string) => {
    setCourseToDelete({ id: courseId, title: courseTitle });
    setDeleteConfirmOpen(true);
    return true;
  };

  const confirmCourseDeletion = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'courses', courseToDelete.id));
      toast.success(`تم حذف كورس "${courseToDelete.title}" بنجاح!`);
      setDeleteConfirmOpen(false);
      setCourseToDelete(null);
    } catch (e: any) {
      console.error("Error deleting course:", e);
      toast.error(e.message || "حدث خطأ أثناء محاولة حذف الكورس");
      try {
        handleFirestoreError(e, OperationType.DELETE, `courses/${courseToDelete.id}`);
      } catch (err) {}
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) return (
    <div className="flex h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="mb-8"
      >
        <div className="rounded-2xl bg-indigo-600 p-4 shadow-2xl shadow-indigo-500/10">
          <GraduationCap className="h-12 w-12 text-white" />
        </div>
      </motion.div>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black tracking-widest text-slate-900 dark:text-white">MATH PRO</h1>
        <div className="flex items-center gap-2 justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce" />
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">جاري تحميل المنصة...</p>
        </div>
      </div>
    </div>
  );

  const teacherCourses = courses.filter(c => c.teacherId === currentUser?.uid);
  const marketplaceCourses = courses.filter(c => c.status === 'approved');
  const pendingCourses = courses.filter(c => c.status === 'pending');
  
  const totalRevenue = teacherCourses.reduce((acc, c) => acc + (c.revenue || 0), 0);
  const totalStudents = teacherCourses.reduce((acc, c) => acc + (c.studentsCount || 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-indigo-100 overflow-x-hidden" dir="rtl">
      <Toaster dir="rtl" />
      
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 font-bold transition-transform hover:scale-102 active:scale-98 min-w-0">
            <img 
              src={mathCenterLogo} 
              alt="شعار مستر أنور عزب" 
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-contain bg-white p-0.5 border border-slate-100 dark:border-zinc-800 shrink-0" 
              referrerPolicy="no-referrer"
            />
            <span className="text-sm sm:text-xl font-black tracking-tight text-slate-900 dark:text-white truncate">سنتر مستر أنور عزب</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all active:scale-95 h-9 w-9 shrink-0"
              title={theme === 'light' ? 'تفعيل الوضع الليلي' : 'تفعيل وضع النهار'}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5 text-slate-600" />
              ) : (
                <Sun className="h-5 w-5 text-amber-500" />
              )}
            </Button>

            {dbConnected === false && (
              <Badge variant="destructive" className="animate-pulse gap-1 text-[10px] py-0 px-2 rounded-full shrink-0">
                <XCircle className="h-3 w-3" /> خطأ الاتصال
              </Badge>
            )}
            {dbConnected === true && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 rounded-full border border-emerald-100/50 dark:border-emerald-900/30 shrink-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-none" />
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">متصل بالقاعدة</span>
              </div>
            )}
            {!currentUser ? (
              <Button 
                onClick={() => {
                  setAuthTab('signin');
                  setAuthModalOpen(true);
                }} 
                className="rounded-full bg-indigo-600 px-4 sm:px-6 shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 font-bold text-xs sm:text-sm h-9 sm:h-10"
              >
                <LogIn className="ml-1 sm:ml-2 h-4 w-4" /> تسجيل الدخول
              </Button>
            ) : (
              <div className="flex items-center gap-2 sm:gap-4">
                <Badge variant="secondary" className="hidden sm:inline-flex bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950 border-none px-3 py-1">
                  {currentUser.role === 'admin' ? (
                    <><ShieldCheck className="ml-1 h-3 w-3" /> أدمن</>
                  ) : currentUser.role === 'teacher' ? (
                    <><School className="ml-1 h-3 w-3" /> مدرس</>
                  ) : (
                    <><User className="ml-1 h-3 w-3" /> طالب</>
                  )}
                </Badge>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold leading-none">{currentUser.displayName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                </div>
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-indigo-100 dark:border-zinc-800 ring-2 ring-white dark:ring-zinc-950 transition-all hover:border-indigo-500">
                  <AvatarImage src={currentUser.photoURL} />
                  <AvatarFallback>{currentUser.displayName[0]}</AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="sm" onClick={() => signOut(auth)} className="text-slate-500 dark:text-slate-400 hover:text-red-500 text-xs sm:text-sm h-8 sm:h-9 px-2">خروج</Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl p-4 sm:p-8">
        {/* GLOBAL COURSE MODAL */}
        <Dialog open={courseModalOpen} onOpenChange={setCourseModalOpen}>
          <DialogContent className="sm:max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden text-right">
            <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0 rounded-none">
              <DialogTitle className="text-2xl font-black tracking-tight">{editingCourse ? 'تعديل الكورس' : 'إطلاق كورس احترافي'}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              {currentUser && (
                <CourseModal 
                  userId={currentUser.uid} 
                  userName={currentUser.displayName} 
                  course={editingCourse}
                  onOpenChange={setCourseModalOpen} 
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Tabs value={activeTab} className="space-y-6 sm:space-y-8" onValueChange={setActiveTab}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
               <TabsList className="bg-slate-100 p-1 dark:bg-slate-900 border-none rounded-xl inline-flex w-auto whitespace-nowrap">
                 <TabsTrigger value="marketplace" className="flex gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                   <ShoppingCart className="h-4 w-4" /> المنهج الدراسي
                 </TabsTrigger>
                 {currentUser && (
                   <TabsTrigger value="mylearning" className="flex gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                     <BookOpen className="h-4 w-4" /> دروسي
                   </TabsTrigger>
                 )}
                 {currentUser?.role === 'teacher' && currentUser.status === 'approved' && (
                   <TabsTrigger value="teach" className="flex gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                     <School className="h-4 w-4" /> منصة المدرس
                   </TabsTrigger>
                 )}
                 {currentUser?.role === 'admin' && (
                   <TabsTrigger value="admin" className="flex gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                     <LayoutDashboard className="h-4 w-4" /> الإدارة
                   </TabsTrigger>
                 )}
               </TabsList>
            </div>
            
            <div className="flex gap-2 justify-start">
              {currentUser?.role === 'student' && currentUser.status !== 'pending' && (
                <Button variant="outline" onClick={applyToBeTeacher} className="border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50">
                  كن مدرساً معنا
                </Button>
              )}
              {currentUser?.role === 'teacher' && currentUser.status === 'approved' && (
                <Button onClick={() => { setEditingCourse(null); setCourseModalOpen(true); }} className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-100 rounded-xl">
                  <PlusCircle className="ml-2 h-4 w-4" /> إنشاء كورس
                </Button>
              )}
            </div>
          </div>

          {/* CURRICULUM MARKETPLACE */}
          <TabsContent value="marketplace" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HERO SECTION */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-card border border-border p-6 sm:p-10 mb-12 shadow-sm flex flex-col md:flex-row-reverse items-center justify-between gap-8">
              {/* Decorative background gradients */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/10 via-transparent to-orange-50/10 pointer-events-none" />
              
              {/* Logo container under the navbar logo in home layout, optimized size, no distortion */}
              <div className="relative z-10 w-full md:w-5/12 flex justify-center group/logo">
                {/* Dynamic background glow halo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-gradient-to-tr from-indigo-500/15 to-amber-500/15 blur-2xl opacity-80 group-hover/logo:scale-110 group-hover/logo:from-indigo-500/30 group-hover/logo:to-amber-500/30 transition-all duration-500 pointer-events-none" />
                
                <div className="relative p-3 rounded-[2rem] bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 max-w-[260px] sm:max-w-[300px] w-[240px] h-[240px] sm:w-full sm:h-auto aspect-square flex items-center justify-center transition-all duration-500 hover:scale-[1.03] hover:border-indigo-100 shadow-sm hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)]">
                  {/* Subtle card overlay gradient */}
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-indigo-50/20 via-transparent to-amber-50/20 opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <img 
                    src={mathCenterLogo} 
                    alt="مستر أنور عزب - معلمي رياضيات" 
                    className="w-full h-full object-contain rounded-[1.5rem] relative z-10"
                    style={{ mixBlendMode: theme === 'light' ? 'multiply' : 'normal' }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-3 bg-indigo-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-indigo-200 tracking-wider z-20 group-hover/logo:scale-105 transition-transform duration-300">
                    المنصة الرسمية
                  </div>
                </div>
              </div>

              {/* Text content */}
              <div className="relative z-10 w-full md:w-7/12 text-right space-y-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-full border border-amber-100 dark:border-amber-900/30 text-xs font-bold">
                  ⭐ منصة مستر أنور عزب التعليمية للرياضيات
                </div>
                <h1 className="text-3xl font-black sm:text-5xl text-slate-900 dark:text-white leading-[1.25]">
                  مرحباً بك في منصة <br />
                  <span className="text-indigo-600 dark:text-indigo-400">مستر أنور عزب</span> للرياضيات
                </h1>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                  ابدأ رحلة التفوق والدرجات النهائية في مادة الرياضيات للمرحلتين الإعدادية والثانوية مع أقوى الكورسات والدروس التفاعلية المصممة خصيصاً لمساعدتك على النجاح.
                </p>
                <div className="flex flex-wrap gap-3 justify-start md:justify-end pt-2">
                  <Button 
                    onClick={() => {
                      const element = document.getElementById('courses-list');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                  >
                    استكشف المنهج الدراسي
                  </Button>
                  {!currentUser && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setAuthTab('signup');
                        setAuthModalOpen(true);
                      }}
                      className="border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-900 h-12 px-6 rounded-xl"
                    >
                      إنشاء حساب مجاني
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-5">
              <div className="text-right">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  المنهج <span className="text-indigo-600 dark:text-indigo-400">الدراسي</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">اكتشف الكورسات والدروس المتاحة للالتحاق الفوري</p>
              </div>
              {marketplaceCourses.length === 0 && (currentUser?.role === 'admin' || (currentUser?.role === 'teacher' && currentUser.status === 'approved')) && (
                 <Button onClick={() => { setEditingCourse(null); setCourseModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 rounded-xl">
                   <PlusCircle className="ml-2 h-4 w-4" /> ابدأ بإنشاء المنهج التعليمي
                 </Button>
              )}
            </div>

            <div id="courses-list" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {marketplaceCourses.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                   <div className="mb-6 rounded-3xl bg-slate-100 p-8 dark:bg-slate-900 border-2 border-dashed border-slate-200">
                    <BookOpen className="h-16 w-16 text-slate-300" />
                   </div>
                   <h3 className="text-2xl font-bold text-slate-400">لا توجد كورسات متاحة حالياً</h3>
                   <p className="text-slate-400 mt-2">ترقبوا إطلاق الكورسات الأولى قريباً!</p>
                </div>
              )}
              {marketplaceCourses.map((course) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -8 }}
                  className="premium-card group"
                >
                  <img src={course.thumbnail || 'https://images.unsplash.com/photo-1509228468518-180dd4821827?auto=format&fit=crop&q=80&w=800'} alt={course.title} className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
                  <CardContent className="p-6 text-right">
                    <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                      <Badge className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-none font-medium px-2 py-0.5">{course.category}</Badge>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{course.studentsCount || 0} طالب</span>
                    </div>
                    <h3 className="mb-3 text-xl font-bold leading-snug line-clamp-1 text-slate-900 group-hover:text-indigo-600 transition-colors">{course.title}</h3>
                    <p className="mb-6 line-clamp-2 text-sm text-slate-500 leading-relaxed">{course.description}</p>
                    
                    <Dialog>
                      <DialogTrigger render={<Button variant="ghost" size="sm" className="w-full mb-4 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl" />}>
                        <BookOpen className="ml-1 h-3 w-3" /> استعراض المنهج الدراسي
                      </DialogTrigger>
                      <DialogContent className="text-right">
                        <DialogHeader>
                          <DialogTitle>منهج كورس: {course.title}</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                          <CurriculumPreview modules={course.content || []} />
                        </div>
                      </DialogContent>
                    </Dialog>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-5 flex-row-reverse">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 ring-2 ring-indigo-50">
                          <AvatarFallback className="bg-indigo-600 text-white text-[10px]">{course.teacherName?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-slate-600">{course.teacherName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-black text-slate-900">${course.price}</span>
                        {myEnrollments.includes(course.id) ? (
                          <Badge className="bg-emerald-50 text-emerald-600 border-none shadow-sm px-3">منضم</Badge>
                        ) : (
                          <Button 
                            size="sm" 
                            className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-lg px-5 active:scale-95"
                            onClick={() => handlePaymentSuccess(course.id)}
                          >
                            اشتراك
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* ADMIN DASHBOARD */}
          {currentUser?.role === 'admin' && (
            <TabsContent value="admin" className="m-0 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* Platform Stats */}
               <div className="grid gap-6 md:grid-cols-4">
                  <Card className="border-none shadow-lg bg-indigo-600 text-white overflow-hidden relative">
                    <div className="p-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">إجمالي الكورسات</p>
                      <h3 className="text-3xl font-black">{courses.length}</h3>
                    </div>
                    <BookOpen className="absolute -bottom-2 -right-2 h-16 w-16 opacity-10" />
                  </Card>
                  <Card className="border-none shadow-lg bg-emerald-600 text-white overflow-hidden relative">
                    <div className="p-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">الكورسات المنشورة</p>
                      <h3 className="text-3xl font-black">{marketplaceCourses.length}</h3>
                    </div>
                    <CheckCircle className="absolute -bottom-2 -right-2 h-16 w-16 opacity-20" />
                  </Card>
                  <Card className="border-none shadow-lg bg-orange-600 text-white overflow-hidden relative">
                    <div className="p-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">بانتظار المراجعة</p>
                      <h3 className="text-3xl font-black">{pendingCourses.length}</h3>
                    </div>
                    <HelpCircle className="absolute -bottom-2 -right-2 h-16 w-16 opacity-20" />
                  </Card>
                  <Card className="border-none shadow-lg bg-slate-900 text-white overflow-hidden relative">
                    <div className="p-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">طلبات المدرسين</p>
                      <h3 className="text-3xl font-black">{pendingTeachers.length}</h3>
                    </div>
                    <School className="absolute -bottom-2 -right-2 h-16 w-16 opacity-10" />
                  </Card>
               </div>

               {/* Moderation section */}
               <div className="grid gap-8 lg:grid-cols-3">
                <Card className="border-none shadow-xl bg-white">
                  <CardContent className="p-0">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between flex-row-reverse bg-slate-50/50 rounded-t-3xl">
                       <h2 className="text-xl font-black flex items-center gap-3">
                          مراجعة الكورسات
                       </h2>
                       <Badge className="bg-orange-600 text-white">{pendingCourses.length}</Badge>
                    </div>
                    <div className="p-6 space-y-4">
                        {pendingCourses.map(course => (
                          <div key={course.id} className="group p-4 rounded-2xl bg-white border border-slate-100 flex flex-col gap-3 text-right">
                            <div className="flex items-center gap-3 flex-row-reverse">
                              <img src={course.thumbnail} className="h-10 w-14 rounded-lg object-cover" />
                              <div className="flex-1">
                                <h4 className="font-bold text-xs truncate">{course.title}</h4>
                                <p className="text-[10px] text-slate-500">بواسطة: {course.teacherName}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="text-emerald-600 h-8 text-[10px] flex-1" onClick={() => updateCourseStatus(course.id, 'approved')}>قبول</Button>
                              <Button size="sm" variant="ghost" className="text-red-500 h-8 text-[10px]" onClick={() => updateCourseStatus(course.id, 'rejected')}>رفض</Button>
                            </div>
                          </div>
                        ))}
                        {pendingCourses.length === 0 && <p className="text-[10px] text-slate-400 text-center py-4">لا توجد كورسات معلقة</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-white">
                  <CardContent className="p-0">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between flex-row-reverse bg-slate-50/50 rounded-t-3xl">
                       <h2 className="text-xl font-black flex items-center gap-3">
                          طلبات المدرسين
                       </h2>
                       <Badge className="bg-indigo-600 text-white">{pendingTeachers.length}</Badge>
                    </div>
                    <div className="p-6 space-y-4">
                       {pendingTeachers.map(teacher => (
                          <div key={teacher.uid} className="p-4 rounded-2xl bg-white border border-slate-100 flex items-center justify-between flex-row-reverse">
                            <div className="flex items-center gap-3 flex-row-reverse">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={teacher.photoURL} />
                                <AvatarFallback>{teacher.displayName?.[0]}</AvatarFallback>
                              </Avatar>
                              <div className="text-right">
                                <h4 className="font-bold text-xs">{teacher.displayName}</h4>
                              </div>
                            </div>
                            <Button size="sm" className="bg-indigo-600 h-8 text-[10px]" onClick={() => updateUserRole(teacher.uid, 'teacher', 'approved')}>قبول</Button>
                          </div>
                        ))}
                        {pendingTeachers.length === 0 && <p className="text-[10px] text-slate-400 text-center py-4">لا توجد طلبات تدريس</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-white">
                  <CardContent className="p-0">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between flex-row-reverse bg-slate-50/50 rounded-t-3xl">
                       <h2 className="text-xl font-black flex items-center gap-3">
                          إعدادات الذكاء الاصطناعي
                       </h2>
                       <Cpu className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="p-6 space-y-4 text-right">
                       <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                         أدخل مفتاح Gemini API هنا لضمان عمل الذكاء الاصطناعي عند نقل التطبيق لاستضافتك الخاصة.
                       </p>
                       <div className="space-y-4">
                         <div className="flex items-center justify-between flex-row-reverse mb-2">
                           <Label htmlFor="gemini-key-input" className="text-xs text-slate-500 font-bold">مفتاح Gemini API</Label>
                           <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100">
                             <div className={`w-1.5 h-1.5 rounded-full ${getApiKeySource(currentUser?.role === 'admin') !== 'default' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                             <span className="text-[9px] font-bold text-slate-600">
                               {getApiKeySource(currentUser?.role === 'admin') === 'database' ? 'مفعّل من قاعدة البيانات' : 
                                getApiKeySource(currentUser?.role === 'admin') === 'local' ? 'مفتاح مخزن محلياً' : 'نظام المفتاح الافتراضي'}
                             </span>
                           </div>
                         </div>

                         {currentUser?.role === 'admin' && (
                           <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 flex-row-reverse">
                             <div className="text-right">
                               <Label className="text-xs font-bold text-slate-700 block mb-1">تفعيل للجميع</Label>
                               <span className="text-[9px] text-slate-500">سماح للمستخدمين والمدرسين باستخدام هذا المفتاح</span>
                             </div>
                             <Switch 
                               checked={isActiveForEveryone} 
                               onCheckedChange={async (val) => {
                                 if (!currentUser) return;
                                 setIsActiveForEveryone(val);
                                 try {
                                   const configDoc = await getDoc(doc(db, 'app_settings', 'ai_config'));
                                   const existingKey = configDoc.exists() ? configDoc.data().gemini_key : null;
                                   
                                   await setDoc(doc(db, 'app_settings', 'ai_config'), { 
                                     isActiveForEveryone: val,
                                     gemini_key: existingKey,
                                     updatedAt: new Date() 
                                   });
                                   setGlobalApiKey(existingKey, val);
                                   toast.success(val ? "تم تفعيل المفتاح للجميع" : "تم قصر المفتاح على المسؤول فقط");
                                 } catch (e) {
                                   toast.error("فشل في تحديث الإعدادات");
                                 }
                               }} 
                             />
                           </div>
                         )}

                         <div className="space-y-3">
                            <div className="flex gap-2 flex-wrap">
                               <Button 
                                 className="bg-indigo-600 hover:bg-indigo-700 h-9 px-4 rounded-xl text-[10px] flex-1 min-w-[100px]"
                                 disabled={isSavingKey}
                                 onClick={async () => {
                                   const key = (document.getElementById('gemini-key-input') as HTMLInputElement).value;
                                   if (currentUser?.role !== 'admin') return;
                                   
                                   setIsSavingKey(true);
                                   try {
                                     if (key) {
                                       await setDoc(doc(db, 'app_settings', 'ai_config'), { 
                                         gemini_key: key, 
                                         isActiveForEveryone,
                                         updatedAt: new Date() 
                                       });
                                       setGlobalApiKey(key, isActiveForEveryone);
                                       toast.success("تم حفظ المفتاح في قاعدة البيانات.");
                                     } else {
                                       await setDoc(doc(db, 'app_settings', 'ai_config'), { gemini_key: null, isActiveForEveryone: false });
                                       toast.info("تم إزالة المفتاح من قاعدة البيانات.");
                                     }
                                   } catch (e) {
                                     toast.error("فشل حفظ المفتاح.");
                                   } finally {
                                     setIsSavingKey(false);
                                   }
                                 }}
                               >
                                 {isSavingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : "حفظ للكل (Cloud)"}
                               </Button>
                               <Button 
                                 variant="outline"
                                 className="border-indigo-100 text-indigo-600 h-9 px-4 rounded-xl text-[10px] flex-1 min-w-[100px]"
                                 onClick={() => {
                                   const key = (document.getElementById('gemini-key-input') as HTMLInputElement).value;
                                   if (key) {
                                     localStorage.setItem('GEMINI_CUSTOM_API_KEY', key);
                                     toast.success("تم حفظ المفتاح محلياً في هذا المتصفح.");
                                   } else {
                                     localStorage.removeItem('GEMINI_CUSTOM_API_KEY');
                                     toast.info("تم مسح المفتاح المحلي.");
                                   }
                                 }}
                               >
                                 حفظ محلي (Local)
                               </Button>
                               <Button 
                                 variant="outline"
                                 className="border-slate-200 text-slate-600 h-9 px-3 rounded-xl text-[10px]"
                                 onClick={async () => {
                                   const loadingToast = toast.loading("جاري اختبار المفتاح...");
                                   try {
                                     await testGeminiConnection();
                                     toast.dismiss(loadingToast);
                                     toast.success("المفتاح يعمل بنجاح!");
                                   } catch (e) {
                                     toast.dismiss(loadingToast);
                                     toast.error("فشل الاتصال.");
                                   }
                                 }}
                               >
                                 اختبار
                               </Button>
                            </div>
                            
                            {getApiKeySource() === 'local' && (
                              <Button 
                                variant="ghost" 
                                className="w-full h-8 text-[9px] text-rose-500 hover:text-rose-600 hover:bg-rose-50 border border-rose-100 border-dashed rounded-lg"
                                onClick={() => {
                                  clearLocalApiKey();
                                  toast.info("تم مسح المفتاح المحلي. سيتم استخدام مفتاح قاعدة البيانات الآن.");
                                }}
                              >
                                مسح المفتاح المحلي (لاختبار مفتاح الجميع)
                              </Button>
                            )}

                            <Input 
                              id="gemini-key-input"
                              type="password" 
                              placeholder="أدخل المفتاح هنا..." 
                              defaultValue={localStorage.getItem('GEMINI_CUSTOM_API_KEY') || ''}
                              className="h-9 bg-slate-50 border-slate-100 rounded-xl text-left font-mono text-xs"
                            />
                         </div>
                       </div>
                    </div>
                  </CardContent>
                </Card>
               </div>

               {/* Admin My Content Management */}
               <section className="space-y-6 pt-10">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-row-reverse">
                  <h2 className="text-2xl font-black text-slate-900">إدارة محتوى المسؤول</h2>
                  <Button onClick={() => { setEditingCourse(null); setCourseModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 rounded-xl shadow-lg">
                    <PlusCircle className="ml-2 h-4 w-4" /> إنشاء كورس جديد
                  </Button>
                </div>
                {courses.filter(c => c.teacherId === currentUser.uid).length > 0 ? (
                  <div className="grid gap-4">
                    {courses.filter(c => c.teacherId === currentUser.uid).map(course => (
                      <div key={course.id} className="group flex flex-col sm:flex-row items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all gap-4 flex-row-reverse">
                        <div className="flex items-center gap-4 text-right w-full sm:w-auto flex-row-reverse">
                          <img src={course.thumbnail} className="h-16 w-24 object-cover rounded-xl shadow-sm" />
                          <div className="flex-1">
                            <p className="font-bold text-lg text-slate-900">{course.title}</p>
                            <div className="flex items-center gap-2 mt-1 justify-end">
                              <Badge className={`${course.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'} border-none text-[10px]`}>
                                {course.status === 'approved' ? 'منشور' : 'بانتظار المراجعة'}
                              </Badge>
                              <span className="text-[10px] text-slate-400">{course.studentsCount} طالب</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-start">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCourse(course); setCourseModalOpen(true); }} className="text-indigo-600 font-bold hover:bg-indigo-50 rounded-xl px-4">تعديل المنهج</Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl"
                            onClick={() => initiateCourseDeletion(course.id, course.title)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center">
                    <p className="text-slate-400 font-bold mb-4">لم تقم بإنشاء أي محتوى تعليمي بعد كمسؤول</p>
                    <Button onClick={() => { setEditingCourse(null); setCourseModalOpen(true); }} variant="outline" className="rounded-xl">أضف أول كورس لك الآن</Button>
                  </div>
                )}
               </section>

               {/* لوحة تحكم كاملة وشاملة لحذف أي كورس في المنصة كمسؤول */}
               <section className="space-y-6 pt-10 border-t border-slate-100">
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-2 flex-row-reverse text-right">
                   <h2 className="text-2xl font-black text-slate-900">لوحة التحكم الشاملة لإدارة كافة كورسات المنصة</h2>
                   <p className="text-xs text-slate-500 font-medium">بصفتك مديراً عاماً للمنصة، يمكنك إدارة وحذف أي كورس منشور أو معلق بصفة نهائية لضمان سلامة وجودة المحتوى التعليمي.</p>
                 </div>

                 <div className="grid gap-4">
                   {courses.map(c => (
                     <div key={c.id} className="group flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-150 shadow-sm hover:shadow-md transition-all gap-4 flex-row-reverse">
                       <div className="flex items-center gap-4 text-right w-full sm:w-auto flex-row-reverse">
                         <img src={c.thumbnail || 'https://images.unsplash.com/photo-1509228468518-180dd4821827?auto=format&fit=crop&q=80&w=800'} className="h-12 w-20 object-cover rounded-lg shadow-sm" />
                         <div className="flex-1">
                           <p className="font-bold text-sm text-slate-900">{c.title}</p>
                           <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                             المدرس: {c.teacherName} • السعر: ${c.price} • الطلاب: {c.studentsCount || 0}
                           </p>
                           <div className="flex items-center gap-2 mt-1 justify-end">
                             <Badge className={`${c.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : c.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'} border-none text-[9px] px-1.5 py-0`}>
                               {c.status === 'approved' ? 'منشور' : c.status === 'pending' ? 'بانتظار المراجعة' : 'مرفوض/مؤرشف'}
                             </Badge>
                           </div>
                         </div>
                       </div>
                       
                       <div className="flex items-center gap-2 w-full sm:w-auto justify-start">
                         <Button size="sm" variant="ghost" onClick={() => { setEditingCourse(c); setCourseModalOpen(true); }} className="text-indigo-600 font-bold hover:bg-indigo-50 rounded-lg text-xs">
                           تعديل المنهج
                         </Button>
                         {c.status !== 'approved' && (
                           <Button size="sm" variant="outline" onClick={() => updateCourseStatus(c.id, 'approved')} className="text-emerald-600 border-emerald-100 hover:bg-emerald-50 text-xs h-8 rounded-lg px-2">
                             قبول ونشر
                           </Button>
                         )}
                         <Button 
                           size="sm" 
                           variant="ghost" 
                           className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg"
                           onClick={async () => {
                             initiateCourseDeletion(c.id, c.title); if (false) {
                               try {
                                 await deleteDoc(doc(db, 'courses', c.id));
                                 toast.success("تم حذف الكورس نهائياً بالكامل من المنصة");
                               } catch(e) {
                                 toast.error(e.message || "فشل إزالة الكورس");
                               }
                             }
                           }}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
                   ))}
                   {courses.length === 0 && (
                     <div className="py-8 text-center text-xs text-slate-400 font-bold">لا توجد كورسات مسجلة في قاعدة البيانات حالياً.</div>
                   )}
                 </div>
               </section>
             </TabsContent>
          )}

          {/* ... existing MY LEARNING and TEACHER DASHBOARD content remains same but styled similarly ... */}

          {/* MY LEARNING */}
          <TabsContent value="mylearning" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {selectedCourse ? (
              <div className="space-y-6">
                <Button variant="ghost" onClick={() => setSelectedCourse(null)} className="mb-4 text-slate-500 hover:text-indigo-600">
                   العودة للقائمة الرئيسية →
                </Button>
                <CoursePlayer course={selectedCourse} currentUser={currentUser} />
              </div>
            ) : (
              <>
                <h2 className="mb-8 text-3xl font-black text-slate-900 dark:text-white">كورساتي التعليمية</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.filter(c => myEnrollments.includes(c.id)).map(course => (
                    <div key={course.id} onClick={() => setSelectedCourse(course)} className="premium-card group cursor-pointer overflow-hidden p-0">
                      <div className="relative h-40 overflow-hidden">
                        <img src={course.thumbnail} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-indigo-600/20 mix-blend-overlay" />
                      </div>
                      <CardContent className="p-6 text-right">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                          <BookOpen className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold leading-tight mb-2">{course.title}</h3>
                        <p className="text-xs text-slate-500">مستوى متقدم • بواسطة {course.teacherName}</p>
                        <Button className="w-full mt-6 bg-slate-900 text-white hover:bg-indigo-600">متابعة التعلم</Button>
                      </CardContent>
                    </div>
                  ))}
                  {myEnrollments.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center rounded-3xl bg-white border border-slate-100 shadow-sm">
                      <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                        <BookOpen className="h-10 w-10 text-slate-200" />
                      </div>
                      <p className="text-xl font-bold text-slate-500">لم تشترك في أي كورسات بعد.</p>
                      <Button variant="link" onClick={() => setActiveTab('marketplace')} className="text-indigo-600 text-lg font-bold mt-4">استكشاف المنهج الدراسي</Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* TEACHER DASHBOARD */}
          <TabsContent value="teach" className="m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 md:grid-cols-3 mb-12">
              <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl transition-transform group-hover:scale-150" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">إجمالي الأرباح</p>
                <div className="flex items-baseline gap-1 flex-row-reverse">
                  <h3 className="text-4xl font-black">${totalRevenue.toFixed(2)}</h3>
                  <Badge className="bg-indigo-500/20 text-indigo-400 border-none">صافي</Badge>
                </div>
                <div className="mt-6 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
                  <DollarSign className="h-5 w-5 text-indigo-400" />
                </div>
              </div>
              
              <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-xl group">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">إجمالي الطلاب</p>
                <h3 className="text-4xl font-black text-slate-900">{totalStudents}</h3>
                <div className="mt-6 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <GraduationCap className="h-5 w-5" />
                </div>
              </div>

              <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-xl group">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">كورساتك</p>
                <h3 className="text-4xl font-black text-slate-900">{teacherCourses.length}</h3>
                <div className="mt-6 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <BookOpen className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-black text-right px-2">إدارة المحتوى التعليمي</h3>
              <div className="grid gap-4">
                {teacherCourses.map(course => (
                  <div key={course.id} className="premium-card p-4 flex items-center justify-between flex-row-reverse hover:shadow-md bg-white border-none">
                    <div className="flex items-center gap-6 flex-row-reverse text-right">
                      <div className="relative h-16 w-16 overflow-hidden rounded-xl shadow-inner">
                        <img src={course.thumbnail} className="absolute inset-0 h-full w-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">{course.title}</h4>
                        <div className="flex gap-3 mt-1 flex-row-reverse">
                          <span className="text-xs font-medium text-slate-400">السعر: ${course.price}</span>
                          <span className="text-xs font-medium text-slate-400">•</span>
                          <span className="text-xs font-medium text-slate-400">{course.studentsCount} طالب</span>
                          <span className="text-xs font-medium text-slate-400">•</span>
                          <Badge className={`${course.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'} border-none text-[10px] px-2 py-0`}>
                            {course.status === 'approved' ? 'منشور' : 'بانتظار المراجعة'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <div className="text-left bg-slate-50 px-6 py-2 rounded-2xl border border-slate-100 w-full sm:w-auto">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">العائد</p>
                        <p className="text-lg font-black text-indigo-600">${(course.revenue || 0).toFixed(2)}</p>
                      </div>
                      <div className="flex gap-2 w-full justify-end">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => { setEditingCourse(course); setCourseModalOpen(true); }}
                          className="text-xs text-indigo-600 hover:bg-indigo-50 font-bold px-3 h-8 rounded-lg"
                        >
                          تعديل المنهج الدراسي
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 px-2 rounded-lg text-xs flex items-center gap-1.5"
                          onClick={async () => {
                            initiateCourseDeletion(course.id, course.title); if (false) {
                              try {
                                await deleteDoc(doc(db, 'courses', course.id));
                                toast.success("تم حذف الكورس بنجاح!");
                              } catch(e) {
                                toast.error(e.message || "حدث خطأ أثناء محاولة حذف الكورس");
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> حذف الكورس
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {teacherCourses.length === 0 && (
                  <div className="py-20 text-center border-3 border-dashed rounded-3xl border-slate-100 dark:border-slate-800">
                    <p className="text-slate-400 text-lg font-medium">ابدأ رحلتك التعليمية الآن وارفع أول كورس لك.</p>
                    <Button className="mt-6 bg-indigo-600 rounded-xl" onClick={() => { setEditingCourse(null); setCourseModalOpen(true); }}>أنشئ كورسك الأول</Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* AI TUTOR FAB */}
      <div className="fixed bottom-8 left-8 z-50">
        <Sheet open={aiOpen} onOpenChange={setAiOpen}>
          <SheetTrigger render={<Button className="h-16 w-16 rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-500/40 hover:scale-110 active:scale-95 border-none transition-transform" />}>
            <MessageSquare className="h-7 w-7 text-white" />
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col sm:max-w-md border-none glass-panel text-right p-0 rounded-r-3xl overflow-hidden">
            <div className="p-6 bg-indigo-600 text-white">
              <div className="mb-4 flex items-center gap-3 flex-row-reverse">
                <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-black leading-none">معلمك الخاص</h2>
                  <p className="text-[10px] text-indigo-100 mt-1 uppercase tracking-widest">الذكاء الاصطناعي متاح 24/7</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-indigo-100">
              {aiChat.length === 0 && (
                <div className="mt-20 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="mx-auto h-24 w-24 rounded-[2rem] bg-indigo-50/50 flex items-center justify-center mb-6">
                     <MessageSquare className="h-10 w-10 text-indigo-200" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">كيف يمكنني مساعدتك اليوم؟</h3>
                  <p className="text-sm text-slate-400 px-8 leading-relaxed italic">"يمكنني مساعدتك في حل أصعب المعادلات الرياضية وتوضيح المفاهيم المعقدة."</p>
                </div>
              )}
              {aiChat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-[1.5rem] px-5 py-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-50'}`}>
                    {msg.parts[0].text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-white border-t border-slate-50">
              <div className="flex gap-2 flex-row-reverse">
                <Input 
                  placeholder="اكتب استفسارك هنا..." 
                  value={currentQuestion}
                  onChange={(e) => setCurrentQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askAi()}
                  className="rounded-xl bg-slate-50 border-none h-12 text-right focus:ring-2 focus:ring-indigo-100"
                />
                <Button onClick={askAi} size="icon" className="h-12 w-12 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700">
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Custom Delete Confirmation Dialog to replace window.confirm inside iframes */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md p-6 text-right rounded-[2rem] overflow-hidden border-none shadow-2xl bg-white animate-in zoom-in-95 duration-200">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black text-slate-900 text-right">تأكيد حذف الكورس نهائياً</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed text-right">
              هل أنت متأكد من حذف كورس <span className="font-extrabold text-indigo-600">"{courseToDelete?.title}"</span> وقسمه ودروسه بالكامل ونهائياً؟
            </p>
            <p className="text-xs text-rose-500 font-bold bg-rose-50 p-4 rounded-2xl border border-rose-100 text-right">
              تنبيه هام جداً: هذه العملية لا يمكن التراجع عنها مطلقاً وسيتم حذف كافة الفيديوهات والمحتويات المرتبطة بهذا الكورس من قاعدة البيانات نهائياً.
            </p>
            <div className="flex gap-3 justify-start mt-6 pt-2">
              <Button
                variant="outline"
                className="rounded-xl px-5 py-2 font-bold text-slate-500 hover:text-slate-800"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setCourseToDelete(null);
                }}
                disabled={isDeleting}
              >
                إلغاء
              </Button>
              <Button
                variant="default"
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-6 py-2 font-bold flex items-center gap-2"
                onClick={confirmCourseDeletion}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    تأكيد حذف الكورس
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified Auth Modal */}
      <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
        <DialogContent className="sm:max-w-md p-6 text-right rounded-[2rem] overflow-hidden border-none shadow-2xl bg-white animate-in zoom-in-95 duration-200">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-black text-slate-900 text-right">
              {authTab === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'signin' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl mb-6">
              <TabsTrigger value="signin" className="rounded-lg font-bold">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg font-bold">حساب جديد</TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              {/* Google Auth with Custom Error Handling and Fallback Message */}
              <Button 
                type="button"
                onClick={async () => {
                  setAuthLoadingState(true);
                  try {
                    await loginWithGoogle();
                    toast.success("تم تسجيل الدخول بنجاح!");
                    setAuthModalOpen(false);
                  } catch (err: any) {
                    console.error("Auth error details:", err);
                    const errMsg = err?.message || '';
                    const errCode = err?.code || '';
                    if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain')) {
                      toast.error("هذا النطاق غير مصرح به لتسجيل الدخول بـ Google! يرجى استخدام 'تسجيل الدخول بالبريد الإلكتروني' بالأسفل مباشرة في ثوانٍ معدودة دون الحاجة لأي إعدادات معقدة.");
                    } else if (errCode === 'auth/popup-closed-by-user' || errMsg.includes('popup-closed-by-user')) {
                      toast.error("تم إغلاق نافذة تسجيل الدخول.");
                    } else {
                      toast.error(`فشل الدخول بجوجل: ${err.message || 'يرجى تجربة البريد الإلكتروني أدناه'}`);
                    }
                  } finally {
                    setAuthLoadingState(false);
                  }
                }}
                disabled={authLoadingState}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 h-12 rounded-xl shadow-sm font-bold shrink-0"
              >
                <LogIn className="h-4 w-4" />
                <span>الدخول السريع بحساب Google</span>
              </Button>

              <div className="flex items-center my-4">
                <div className="flex-1 border-t border-slate-100"></div>
                <span className="px-3 text-[11px] text-slate-400 font-bold bg-white">أو بالبريد (يعمل على أي استضافة دون قيود)</span>
                <div className="flex-1 border-t border-slate-100"></div>
              </div>

              {authTab === 'signin' ? (
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-right block font-bold text-slate-700 text-xs">البريد الإلكتروني</Label>
                    <Input 
                      type="email" 
                      placeholder="name@example.com" 
                      value={authEmail} 
                      onChange={(e) => setAuthEmail(e.target.value)} 
                      className="text-right rounded-xl h-11 border-slate-200 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-right block font-bold text-slate-700 text-xs">كلمة المرور</Label>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      value={authPassword} 
                      onChange={(e) => setAuthPassword(e.target.value)} 
                      className="text-right rounded-xl h-11 border-slate-200 text-sm"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={authLoadingState} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl mt-4"
                  >
                    {authLoadingState ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : (
                      "تسجيل الدخول ببريدك"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-right block font-bold text-slate-700 text-xs">الاسم الكامل</Label>
                    <Input 
                      type="text" 
                      placeholder="عبدالله محمد" 
                      value={authName} 
                      onChange={(e) => setAuthName(e.target.value)} 
                      className="text-right rounded-xl h-11 border-slate-200 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-right block font-bold text-slate-700 text-xs">البريد الإلكتروني</Label>
                    <Input 
                      type="email" 
                      placeholder="name@example.com" 
                      value={authEmail} 
                      onChange={(e) => setAuthEmail(e.target.value)} 
                      className="text-right rounded-xl h-11 border-slate-200 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-right block font-bold text-slate-700 text-xs">كلمة المرور</Label>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      value={authPassword} 
                      onChange={(e) => setAuthPassword(e.target.value)} 
                      className="text-right rounded-xl h-11 border-slate-200 text-sm"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={authLoadingState} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl mt-4"
                  >
                    {authLoadingState ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : (
                      "إنشاء حساب بالبريد"
                    )}
                  </Button>
                </form>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
