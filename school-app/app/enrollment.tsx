// @ts-nocheck
// app/enrollment.tsx — St. Cecilia's College Registration Form

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setToken } from '../src/api';

const C = {
  primary: '#1A3A6B',
  accent:  '#8B1A1A',
  bg:      '#F8F7F4',
  card:    '#FFFFFF',
  border:  '#D4C9B8',
  text:    '#1F1F1F',
  subtext: '#555555',
  muted:   '#888888',
  blue:    '#1A3A6B',
};

const CURRENT_SY    = '2024-2025';
const SEMESTERS     = ['1st', '2nd', 'Summer'];
const YEAR_LEVELS   = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SEXES         = ['Male', 'Female'];
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed'];
const SHS_STRANDS   = ['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'];
const CITIZENSHIPS   = ['Filipino', 'Dual Citizen', 'Foreign National'];

const PH_REGIONS = {
  'NCR - National Capital Region': ['Metro Manila'],
  'CAR - Cordillera Administrative Region': ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
  'Region I - Ilocos Region': ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
  'Region II - Cagayan Valley': ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
  'Region III - Central Luzon': ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
  'Region IV-A - CALABARZON': ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
  'MIMAROPA Region': ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
  'Region V - Bicol Region': ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
  'Region VI - Western Visayas': ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
  'Region VII - Central Visayas': ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
  'Region VIII - Eastern Visayas': ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
  'Region IX - Zamboanga Peninsula': ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
  'Region X - Northern Mindanao': ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
  'Region XI - Davao Region': ['Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
  'Region XII - SOCCSKSARGEN': ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
  'Region XIII - Caraga': ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
  'BARMM - Bangsamoro Autonomous Region': ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'],
};

const PH_CITIES_BY_PROVINCE = {
  Bohol: [
    'Alburquerque', 'Alicia', 'Anda', 'Antequera', 'Baclayon', 'Balilihan', 'Batuan', 'Bien Unido',
    'Bilar', 'Buenavista', 'Calape', 'Candijay', 'Carmen', 'Catigbian', 'Clarin', 'Corella',
    'Cortes', 'Dagohoy', 'Danao', 'Dauis', 'Dimiao', 'Duero', 'Garcia Hernandez', 'Getafe',
    'Guindulman', 'Inabanga', 'Jagna', 'Lila', 'Loay', 'Loboc', 'Loon', 'Mabini',
    'Maribojoc', 'Panglao', 'Pilar', 'President Carlos P. Garcia', 'Sagbayan', 'San Isidro',
    'San Miguel', 'Sevilla', 'Sierra Bullones', 'Sikatuna', 'Tagbilaran City', 'Talibon',
    'Trinidad', 'Tubigon', 'Ubay', 'Valencia',
  ],
  Cebu: [
    'Alcantara', 'Alcoy', 'Alegria', 'Aloguinsan', 'Argao', 'Asturias', 'Badian', 'Balamban',
    'Bantayan', 'Barili', 'Bogo City', 'Boljoon', 'Borbon', 'Carcar City', 'Carmen', 'Catmon',
    'Cebu City', 'Compostela', 'Consolacion', 'Cordova', 'Daanbantayan', 'Dalaguete', 'Danao City',
    'Dumanjug', 'Ginatilan', 'Lapu-Lapu City', 'Liloan', 'Madridejos', 'Malabuyoc', 'Mandaue City',
    'Medellin', 'Minglanilla', 'Moalboal', 'Naga City', 'Oslob', 'Pilar', 'Pinamungajan', 'Poro',
    'Ronda', 'Samboan', 'San Fernando', 'San Francisco', 'San Remigio', 'Santa Fe', 'Santander',
    'Sibonga', 'Sogod', 'Tabogon', 'Tabuelan', 'Talisay City', 'Toledo City', 'Tuburan', 'Tudela',
  ],
  'Negros Oriental': [
    'Amlan', 'Ayungon', 'Bacong', 'Bais City', 'Basay', 'Bayawan City', 'Bindoy', 'Canlaon City',
    'Dauin', 'Dumaguete City', 'Guihulngan City', 'Jimalalud', 'La Libertad', 'Mabinay', 'Manjuyod',
    'Pamplona', 'San Jose', 'Santa Catalina', 'Siaton', 'Sibulan', 'Tanjay City', 'Tayasan',
    'Valencia', 'Vallehermoso', 'Zamboanguita',
  ],
  Siquijor: ['Enrique Villanueva', 'Larena', 'Lazi', 'Maria', 'San Juan', 'Siquijor'],
};

const PH_BARANGAYS_BY_CITY = {
  'Cebu City': [
    'Adlaon', 'Agsungot', 'Apas', 'Babag', 'Bacayan', 'Banilad', 'Basak Pardo', 'Basak San Nicolas',
    'Bonbon', 'Budlaan', 'Buhisan', 'Bulacao', 'Busay', 'Calamba', 'Cambinocot', 'Capitol Site',
    'Carreta', 'Cogon Pardo', 'Cogon Ramos', 'Day-as', 'Duljo Fatima', 'Ermita', 'Guadalupe',
    'Guba', 'Hipodromo', 'Inayawan', 'Kalubihan', 'Kalunasan', 'Kamagayan', 'Kamputhaw',
    'Kasambagan', 'Kinasang-an Pardo', 'Labangon', 'Lahug', 'Lorega San Miguel', 'Lusaran',
    'Luz', 'Mabini', 'Mabolo', 'Malubog', 'Mambaling', 'Pahina Central', 'Pahina San Nicolas',
    'Pamutan', 'Pari-an', 'Paril', 'Pasil', 'Pit-os', 'Poblacion Pardo', 'Pulangbato', 'Pung-ol Sibugay',
    'Punta Princesa', 'Quiot Pardo', 'Sambag I', 'Sambag II', 'San Antonio', 'San Jose',
    'San Nicolas Proper', 'San Roque', 'Santa Cruz', 'Santo Niño', 'Sapangdaku', 'Sawang Calero',
    'Sinsin', 'Sirao', 'Suba', 'Sudlon I', 'Sudlon II', 'T. Padilla', 'Tabunan', 'Tagbao',
    'Talamban', 'Taptap', 'Tejero', 'Tinago', 'Tisa', 'To-ong', 'Zapatera',
  ],
  'Mandaue City': [
    'Alang-alang', 'Bakilid', 'Banilad', 'Basak', 'Cabancalan', 'Cambaro', 'Canduman',
    'Casili', 'Casuntingan', 'Centro', 'Cubacub', 'Guizo', 'Ibabao-Estancia', 'Jagobiao',
    'Labogon', 'Looc', 'Maguikay', 'Mantuyong', 'Opao', 'Pakna-an', 'Pagsabungan',
    'Subangdaku', 'Tabok', 'Tawason', 'Tingub', 'Tipolo', 'Umapad',
  ],
  'Lapu-Lapu City': [
    'Agus', 'Babag', 'Bankal', 'Baring', 'Basak', 'Buaya', 'Calawisan', 'Canjulao',
    'Caw-oy', 'Cawhagan', 'Caubian', 'Gun-ob', 'Ibo', 'Looc', 'Mactan', 'Maribago',
    'Marigondon', 'Pajac', 'Pajo', 'Pangan-an', 'Poblacion', 'Punta Engaño', 'Pusok',
    'Sabang', 'Santa Rosa', 'Subabasbas', 'Talima', 'Tingo', 'Tungasan',
  ],
  'Talisay City': [
    'Biasong', 'Bulacao', 'Cadulawan', 'Camp IV', 'Cansojong', 'Dumlog', 'Jaclupan',
    'Lawaan I', 'Lawaan II', 'Lawaan III', 'Linao', 'Maghaway', 'Manipis', 'Mohon',
    'Poblacion', 'Pooc', 'San Isidro', 'San Roque', 'Tabunok', 'Tangke', 'Tapul',
  ],
  'Naga City': [
    'Alfaco', 'Bairan', 'Balirong', 'Cabungahan', 'Cantao-an', 'Central Poblacion',
    'Cogon', 'Colon', 'East Poblacion', 'Inayagan', 'Inoburan', 'Jaguimit', 'Lanas',
    'Langtad', 'Lutac', 'Mainit', 'Mayana', 'Naalad', 'North Poblacion', 'Pangdan',
    'Patag', 'South Poblacion', 'Tagjaguimit', 'Tangke', 'Tinaan', 'Tuyan', 'Uling',
    'West Poblacion',
  ],
  'Danao City': [
    'Baliang', 'Bayabas', 'Binaliw', 'Cabungahan', 'Cagat-Lamac', 'Cahumayan', 'Cambanay',
    'Cambubho', 'Cogon-Cruz', 'Danasan', 'Dungga', 'Dunggoan', 'Guinsay', 'Guinacot',
    'Ibo', 'Langosig', 'Lawaan', 'Licos', 'Looc', 'Magtagobtob', 'Malapoc', 'Manlayag',
    'Mantija', 'Masaba', 'Maslog', 'Nangka', 'Oguis', 'Pili', 'Poblacion', 'Quisol',
    'Sabang', 'Sacsac', 'Sandayong Norte', 'Sandayong Sur', 'Santa Rosa', 'Santican',
    'Sibacan', 'Suba', 'Taboc', 'Taytay', 'Togonon', 'Tuburan Sur',
  ],
};

const STUDENT_TYPE_OPTIONS = [
  { label: 'Shiftee', value: 'shiftee', payload: 'shiftee' },
  { label: 'Transferee', value: 'transferee', payload: 'transferee' },
  { label: 'Returnee', value: 'returnee', payload: 'returnee' },
  { label: 'New Student', value: 'new_student', payload: 'new_student' },
  { label: 'Old Student', value: 'old_student', payload: 'old_student' },
];

const REQUIREMENTS = [
  'Form 138-A', 'Birth Certificate (NSO)', 'Honorable Dismissal',
  'Certificate of Transfer Credentials', '1x1 Colored Picture (4 pcs.)',
  'Medical Certificate', 'Certificate of Good Moral', 'Drug Test',
];

const CLOSED_MESSAGE = 'Sorry, enrollment is temporarily closed.';

const Field = ({ label, required, children }) => (
  <View style={s.fieldWrap}>
    <Text style={s.inputLabel}>{label}{required ? ' *' : ''}</Text>
    {children}
  </View>
);

const namePartsFromUser = (user) => {
  const parts = (user?.name || '').trim().split(/\s+/).filter(Boolean);

  return {
    first_name: user?.first_name || parts[0] || '',
    middle_name: user?.middle_name || (parts.length > 2 ? parts.slice(1, -1).join(' ') : ''),
    surname: user?.last_name || (parts.length > 1 ? parts[parts.length - 1] : ''),
  };
};

export default function EnrollmentScreen() {
  const router = useRouter();
  const [loading, setLoading]           = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [enrollmentSettings, setEnrollmentSettings] = useState(null);
  const [prerequisiteStatuses, setPrerequisiteStatuses] = useState({});
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [subjects, setSubjects]         = useState([]);
  const [sections, setSections]         = useState([]);
  const [courses, setCourses]           = useState([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const [openSelect, setOpenSelect] = useState(null);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  const [form, setForm] = useState({
    student_type: '',
    shiftee_from: '', shiftee_to: '',
    id_no: '',
    academic_status: '',
    year_level: '', course_program: '', course_id: null,
    section_id: null, section_name: '',
    strand: '',
    semester: '1st', school_year: CURRENT_SY,
    program_type: 'college',
    surname: '', first_name: '', middle_name: '',
    year_born: '', month_born: '', day_born: '',
    sex: '', religion: '', civil_status: '', citizenship: '',
    place_of_birth: '', home_address: '', region: '', province: '', city: '', barangay: '', purok: '', mobile_no: '',
    prev_school: '', prev_school_address: '',
    father_name: '', father_occupation: '',
    mother_name: '', mother_occupation: '',
    parent_email: '',
    email: '', password: '', password_confirmation: '',
    subject_ids: [],
    section_subject_ids: [],
  });
  const [existingStudent, setExistingStudent] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');

  const set = useCallback((key, val) => setForm(p => ({ ...p, [key]: val })), []);

  useEffect(() => {
    const loadEnrollmentSettings = async () => {
      try {
        const res = await api.get('/enrollment/settings');
        const settings = res.data;
        setEnrollmentSettings(settings);
        if (settings?.term) {
          setForm(prev => ({
            ...prev,
            school_year: settings.term.school_year || prev.school_year,
            semester: settings.term.semester === 'summer' ? 'Summer' : settings.term.semester || prev.semester,
          }));
        }
      } catch {
        setEnrollmentSettings({
          enrollment_open: false,
          message: CLOSED_MESSAGE,
        });
      } finally {
        setLoadingSettings(false);
      }
    };

    loadEnrollmentSettings();
  }, []);

  useEffect(() => {
    const loadAuthenticatedStudent = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert(
          'Account required',
          'Please register or log in before enrolling.',
          [{ text: 'Register', onPress: () => router.replace('/register') }]
        );
        return;
      }

      setToken(token);
      try {
        const res = await api.get('/me');
        const user = res.data?.user || res.data;
        if (user?.role === 'student') {
          const registeredName = namePartsFromUser(user);
          setAuthenticatedUser(user);
          setForm(prev => ({
            ...prev,
            email: user.email || prev.email,
            first_name: prev.first_name || registeredName.first_name,
            middle_name: prev.middle_name || registeredName.middle_name,
            surname: prev.surname || registeredName.surname,
          }));

          const pendingId = await AsyncStorage.getItem('pendingEnrollmentId');
          if (pendingId) {
            setForm(prev => ({ ...prev, student_type: 'old_student', id_no: pendingId }));
            await lookupExistingStudent(pendingId, user);
            await AsyncStorage.removeItem('pendingEnrollmentId');
          } else {
            const dashboardRes = await api.get('/dashboard/student');
            const studentId = dashboardRes.data?.student?.student_id;
            if (studentId) {
              setForm(prev => ({ ...prev, student_type: 'old_student', id_no: studentId }));
              await lookupExistingStudent(studentId, user);
            }
          }
        } else {
          Alert.alert('Student account required', 'Please use a student account to submit enrollment.');
          router.replace('/login');
        }
      } catch {
        await AsyncStorage.removeItem('pendingEnrollmentId');
        router.replace('/login');
      }
    };

    loadAuthenticatedStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courseCodeFromName = (name) => {
    if (!name) return '';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const first = words[0];
    const rest = words.slice(1);
    if (/^[A-Z]{1,4}$/.test(first) && rest.length) {
      return first + rest.map(w => w[0]?.toUpperCase() || '').join('');
    }
    return words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 5);
  };

  const normalizeStudentTypeForPayload = (type) => {
    const option = STUDENT_TYPE_OPTIONS.find(o => o.value === type);
    return option ? option.payload : type;
  };

  const fillExistingStudent = (student) => {
    const birth = student.birthdate ? new Date(student.birthdate) : null;
    setForm(prev => ({
      ...prev,
      email: student.email || prev.email,
      surname: student.last_name || prev.surname,
      first_name: student.first_name || prev.first_name,
      middle_name: student.middle_name || prev.middle_name,
      year_born: birth ? String(birth.getFullYear()) : prev.year_born,
      month_born: birth ? String(birth.getMonth() + 1).padStart(2, '0') : prev.month_born,
      day_born: birth ? String(birth.getDate()).padStart(2, '0') : prev.day_born,
      sex: student.gender ? (student.gender === 'female' ? 'Female' : 'Male') : prev.sex,
      religion: student.religion || prev.religion,
      civil_status: student.civil_status || prev.civil_status,
      citizenship: student.citizenship || prev.citizenship,
      place_of_birth: student.place_of_birth || prev.place_of_birth,
      mobile_no: student.phone || prev.mobile_no,
      home_address: student.address || prev.home_address,
      father_name: student.father_name || prev.father_name,
      father_occupation: student.father_occupation || prev.father_occupation,
      mother_name: student.mother_name || prev.mother_name,
      mother_occupation: student.mother_occupation || prev.mother_occupation,
      parent_email: student.parent_email || prev.parent_email,
      prev_school: student.prev_school || prev.prev_school,
      prev_school_address: student.prev_school_address || prev.prev_school_address,
      academic_status: student.academic_status || prev.academic_status,
      shiftee_from: student.shiftee_from || prev.shiftee_from,
      shiftee_to: student.shiftee_to || prev.shiftee_to,
      program_type: student.program_type || prev.program_type,
      grade_level: student.grade_level || prev.grade_level,
      strand: student.strand || prev.strand,
      course_id: student.course_id || prev.course_id,
      course_program: student.course || prev.course_program,
      year_level: student.year_level || prev.year_level,
    }));
  };

  const lookupExistingStudent = async (studentId, user = authenticatedUser) => {
    const idNo = studentId.trim();
    if (!idNo) {
      return Alert.alert('Required', 'Enter a student ID number to look up.');
    }

    setLookupLoading(true);
    setLookupMessage('');
    try {
      const res = await api.get('/enrollment/lookup', { params: { id_no: idNo } });
      const student = res.data;
      const studentName = student.account_name || `${student.first_name || ''} ${student.last_name || ''}`.trim();

      if (student.has_account && !user) {
        await AsyncStorage.setItem('pendingEnrollmentId', idNo);
        setExistingStudent(null);
        Alert.alert(
          'Account already registered',
          `You already have an account registered to ${studentName || 'this School ID'}. Please log in to continue enrollment.`,
          [{ text: 'Log in', onPress: () => router.push('/login') }]
        );
        return;
      }

      if (student.has_account && user?.email && student.email && student.email !== user.email) {
        setExistingStudent(null);
        Alert.alert(
          'Use the registered account',
          `This School ID is registered to ${studentName || student.email}. Please log in with that student account to continue enrollment.`
        );
        return;
      }

      setExistingStudent(student);
      fillExistingStudent(student);
      setLookupMessage('Existing student found. Personal details have been prefilled.');
    } catch {
      setExistingStudent(null);
      setLookupMessage('Student lookup failed. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupStudent = async () => {
    await lookupExistingStudent(form.id_no);
  };

  useEffect(() => {
    if (form.student_type !== 'old_student') {
      setExistingStudent(null);
      setLookupMessage('');
    }
  }, [form.student_type]);

  useEffect(() => {
    setExistingStudent(null);
    setLookupMessage('');
  }, [form.id_no]);

  // Reset course/strand when switching program type
  useEffect(() => {
    setForm(p => ({ ...p, course_id: null, course_program: '', strand: '', year_level: '', section_id: null, section_name: '' }));
    setSubjects([]);
    setSections([]);
  }, [form.program_type]);

  useEffect(() => {
    const sectionMatchesSelection = (section) => {
      if (section.program_type !== form.program_type) return false;
      if (form.program_type === 'college') {
        if (form.course_program && section.course && section.course !== form.course_program) return false;
      } else if (form.strand && section.strand && section.strand !== form.strand) {
        return false;
      }

      const level = form.year_level?.replace(/[^0-9]/g, '');
      return !level || String(section.year_level || '') === level;
    };

    const offeringFromSection = (section) => (offering) => ({
      ...offering.subject,
      offering_id: offering.id,
      section_id: section.id,
      section_name: section.name,
      teacher: offering.teacher?.name,
      days: offering.day,
      time: [offering.time_start, offering.time_end].filter(Boolean).join('-'),
      time_start: offering.time_start,
      time_end: offering.time_end,
      room: offering.room,
    });

    const loadSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const sectionParams = {
          school_year: form.school_year,
          semester: form.semester.toLowerCase(),
        };
        const res = await api.get('/sections', { params: sectionParams });
        const matchingSections = (res.data || []).filter(sectionMatchesSelection);
        setSections(matchingSections);

        if (form.academic_status === 'Regular') {
          const selectedSection = matchingSections.find(section => section.id === form.section_id);

          if (!selectedSection) {
            setSubjects([]);
            setForm(prev => prev.section_id
              ? { ...prev, section_id: null, section_name: '', subject_ids: [], section_subject_ids: [] }
              : prev
            );
            return;
          }

          setSubjects((selectedSection.section_subjects || [])
            .map(offeringFromSection(selectedSection))
            .filter(subject => subject?.id)
            .filter(subject => !subject.semester || String(subject.semester).toLowerCase() === form.semester.toLowerCase()));
        } else if (form.academic_status === 'Irregular') {
          const offerings = matchingSections
            .flatMap(section => (section.section_subjects || []).map(offeringFromSection(section)))
            .filter(subject => {
              if (!subject?.id) return false;
              if (subject.program_type && subject.program_type !== form.program_type) return false;
              if (subject.semester && String(subject.semester).toLowerCase() !== form.semester.toLowerCase()) return false;
              if (form.program_type === 'college' && form.course_program && subject.course && subject.course !== form.course_program) return false;
              if (form.program_type === 'shs' && form.strand && subject.strand && subject.strand !== form.strand) return false;
              return true;
            })
            .filter(subject => subject?.id);
          setSubjects(offerings);
        } else {
          setSubjects([]);
        }
      } catch {
        console.log('Failed to load subjects');
      } finally {
        setLoadingSubjects(false);
      }
    };

    const loadCourses = async () => {
      if (form.program_type !== 'college') return;
      setLoadingCourses(true);
      try {
        const res = await api.get('/courses', {
          params: { program_type: 'college', search: courseSearch.trim() || undefined },
        });
        setCourses(res.data || []);
      } catch {
        console.log('Failed to load courses');
      } finally {
        setLoadingCourses(false);
      }
    };

    loadSubjects();
    loadCourses();
  }, [form.program_type, form.course_id, form.course_program, form.strand, form.year_level, form.semester, form.school_year, form.academic_status, form.section_id, courseSearch]);

  useEffect(() => {
    const subjectIds = [...new Set(subjects.map(subject => Number(subject.id)).filter(Boolean))];
    if (!authenticatedUser || subjectIds.length === 0) {
      setPrerequisiteStatuses({});
      return;
    }

    let cancelled = false;
    api.post('/enrollment/prerequisites', { subject_ids: subjectIds })
      .then(({ data }) => {
        if (cancelled) return;
        setPrerequisiteStatuses(Object.fromEntries(
          (data.subjects || []).map(item => [item.subject_id, item.unmet_prerequisites || []])
        ));
      })
      .catch(() => {
        if (!cancelled) setPrerequisiteStatuses({});
      });

    return () => { cancelled = true; };
  }, [authenticatedUser, subjects]);

  useEffect(() => {
    if (form.academic_status === 'Regular') {
      setForm(prev => ({
        ...prev,
        subject_ids: subjects.map(subject => subject.id),
        section_subject_ids: subjects.map(subject => subject.offering_id).filter(Boolean),
      }));
    }
  }, [form.academic_status, subjects]);

  useEffect(() => {
    if (form.academic_status === 'Irregular') {
      setForm(prev => ({ ...prev, section_id: null, section_name: '', subject_ids: [], section_subject_ids: [] }));
    }
  }, [form.academic_status]);

  const toggleSubject = useCallback((subject) => {
    if (form.academic_status === 'Regular') return;
    const offeringId = subject.offering_id;
    const subjectId = subject.id;
    setForm(prev => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(subjectId)
        ? prev.subject_ids.filter(sid => sid !== subjectId)
        : [...prev.subject_ids, subjectId],
      section_subject_ids: offeringId
        ? (prev.section_subject_ids.includes(offeringId)
            ? prev.section_subject_ids.filter(id => id !== offeringId)
            : [...prev.section_subject_ids, offeringId])
        : prev.section_subject_ids,
    }));
  }, [form.academic_status]);

  const handleSubmit = async () => {
    if (!enrollmentSettings?.enrollment_open) {
      return Alert.alert('Enrollment closed', enrollmentSettings?.message || CLOSED_MESSAGE);
    }

    if (!authenticatedUser)                           return Alert.alert('Account required', 'Please register or log in before enrolling.');
    if (!form.surname.trim() || !form.first_name.trim()) return Alert.alert('Required', 'Full name is required.');
    if (!form.student_type)                           return Alert.alert('Required', 'Please select a student type.');
    if (!form.academic_status)                        return Alert.alert('Required', 'Please select Regular or Irregular.');
    if (form.student_type === 'old_student' && !form.id_no.trim()) return Alert.alert('Required', 'Enter your student ID number for old-student enrollment.');
    if (form.program_type === 'college' && !form.course_id) return Alert.alert('Required', 'Please select a college course from the list.');
    if (form.program_type === 'shs' && !form.strand)  return Alert.alert('Required', 'Please select a strand.');
    if (form.academic_status === 'Regular' && !form.section_id) return Alert.alert('Required', 'Please select a section.');
    if (form.academic_status === 'Irregular' && !form.subject_ids.length) return Alert.alert('Required', 'Please select at least one subject.');
    if (form.academic_status === 'Regular' && !form.section_subject_ids.length) return Alert.alert('Required', 'The selected section has no subjects assigned.');

    const selectedAddress = [form.purok, form.barangay, form.city, form.province, form.region].filter(Boolean).join(', ');
    const fullAddress = [form.home_address, selectedAddress].filter(Boolean).join(', ');

    const payload = {
      email: authenticatedUser.email,
      first_name: form.first_name,
      last_name: form.surname,
      middle_name: form.middle_name,
      birthdate: `${form.year_born}-${form.month_born.padStart(2,'0')}-${form.day_born.padStart(2,'0')}`,
      gender: form.sex.toLowerCase(),
      contact_number: form.mobile_no,
      address: fullAddress,
      place_of_birth: form.place_of_birth,
      religion: form.religion,
      civil_status: form.civil_status,
      citizenship: form.citizenship,
      student_type: normalizeStudentTypeForPayload(form.student_type),
      academic_status: form.academic_status,
      program_type: form.program_type,
      course_id: form.program_type === 'college' ? form.course_id : null,
      course: form.program_type === 'college' ? form.course_program : null,
      strand: form.program_type === 'shs' ? form.strand : null,
      year_level: form.year_level ? form.year_level.replace(/[^0-9]/g, '') : null,
      grade_level: form.program_type === 'shs' ? form.year_level.replace(/[^0-9]/g, '') : null,
      prev_school: form.prev_school,
      prev_school_address: form.prev_school_address,
      father_name: form.father_name,
      father_occupation: form.father_occupation,
      mother_name: form.mother_name,
      mother_occupation: form.mother_occupation,
      parent_email: form.parent_email,
      subject_ids: form.subject_ids,
      section_subject_ids: form.section_subject_ids,
      school_year: form.school_year,
      semester: form.semester.toLowerCase(),
      id_no: form.id_no,
    };

    const body = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(item => body.append(`${key}[]`, String(item)));
      } else if (value !== null && value !== undefined) {
        body.append(key, String(value));
      }
    });
    documents.forEach((doc, index) => {
      body.append('documents[]', {
        uri: doc.uri,
        name: doc.fileName || `enrollment-document-${index + 1}.jpg`,
        type: doc.mimeType || 'image/jpeg',
      });
    });

    setLoading(true);
    try {
      const response = await api.post('/enrollment', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const irregularNotice = response.data?.irregular_due_to_failed_subjects
        ? '\nYour finalized failed subject means this application is marked Irregular.'
        : '';
      Alert.alert(
        '🎉 Application Submitted!',
        `Your registration has been submitted.${irregularNotice}\nTrack using: ${authenticatedUser.email}`,
        [{ text: 'OK', onPress: () => router.replace('/enrollment-status') }]
      );
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickDocuments = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to attach enrollment requirements.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      setDocuments(current => [...current, ...(result.assets ?? [])].slice(0, 10));
    }
  };

  const inp = (field, extra = {}) => (
    <TextInput
      style={[s.input, extra.multiline && { height: 80, textAlignVertical: 'top' }]}
      value={form[field]}
      onChangeText={v => set(field, v)}
      {...extra}
    />
  );

  const Pill = ({ field, opt }) => (
    <TouchableOpacity
      style={[s.pill, form[field] === opt && s.pillActive]}
      onPress={() => set(field, opt)}
    >
      <Text style={[s.pillText, form[field] === opt && s.pillTextActive]}>{opt}</Text>
    </TouchableOpacity>
  );

  const PillRow = ({ field, options, label }) => (
    <View style={s.fieldWrap}>
      {label && <Text style={s.inputLabel}>{label}</Text>}
      <View style={s.pillRow}>
        {options.map(opt => <Pill key={opt} field={field} opt={opt} />)}
      </View>
    </View>
  );

  const renderSelectDropdown = (field, options, placeholder, onSelect) => (
    <>
      <TouchableOpacity
        style={[s.dropdown, form[field] && s.dropdownActive]}
        onPress={() => setOpenSelect(current => current === field ? null : field)}
      >
        <View style={s.dropdownLabelGroup}>
          <Text style={s.dropdownLabel}>
            {form[field] || placeholder}
          </Text>
          <Text style={s.dropdownValue} numberOfLines={1}>
            {form[field] ? 'Tap to change selection' : 'Tap to choose from the list'}
          </Text>
        </View>
        <Text style={s.dropdownArrow}>{openSelect === field ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {openSelect === field && (
        <View style={s.dropdownPanel}>
          <ScrollView
            style={s.dropdownScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[s.courseOption, form[field] === opt && s.courseOptionActive]}
                onPress={() => {
                  if (onSelect) {
                    onSelect(opt);
                  } else {
                    set(field, opt);
                  }
                  setOpenSelect(null);
                }}
              >
                <View style={s.courseOptionLeft}>
                  <View style={s.courseCodeBadge}>
                    <Text style={s.courseCodeText}>{opt.slice(0, 3).toUpperCase()}</Text>
                  </View>
                  <View style={s.courseOptionText}>
                    <Text style={s.courseOptionName}>{opt}</Text>
                    <Text style={s.courseOptionMeta}>Select option</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );

  const CheckItem = ({ label, value }) => (
    <TouchableOpacity style={s.checkRow} onPress={() => set('student_type', value)}>
      <View style={[s.checkBox, form.student_type === value && s.checkBoxActive]}>
        {form.student_type === value && <Text style={s.checkMark}>✓</Text>}
      </View>
      <Text style={s.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const totalUnits = subjects
    .filter(sub => form.academic_status === 'Irregular'
      ? form.section_subject_ids.includes(sub.offering_id)
      : form.subject_ids.includes(sub.id))
    .reduce((acc, sub) => acc + (sub.units_lab || 0) + (sub.units_lec || 0), 0);
  const blockedRegularSubjects = form.academic_status === 'Regular'
    ? subjects.filter(subject => (prerequisiteStatuses[subject.id] || []).length > 0)
    : [];

  const isSHS = form.program_type === 'shs';
  const cityOptions = PH_CITIES_BY_PROVINCE[form.province] || [];
  const barangayOptions = PH_BARANGAYS_BY_CITY[form.city] || [];
  const renderHeader = () => (
    <View style={s.schoolHeader}>
      <Text style={s.schoolName}>{`St. Cecilia's College - Cebu, Inc.`}</Text>
      <Text style={s.schoolSub}>De La Salle Supervised School</Text>
      <Text style={s.deptName}>HIGHER EDUCATION DEPARTMENT</Text>
      <Text style={s.formTitle}>REGISTRATION FORM</Text>
      <Text style={s.ayLine}>A.Y. {form.school_year}</Text>
    </View>
  );

  if (!loadingSettings && enrollmentSettings && !enrollmentSettings.enrollment_open) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={[s.body, s.closedBody]} showsVerticalScrollIndicator={false}>
          {renderHeader()}
          <View style={s.closedCard}>
            <Text style={s.closedTitle}>Enrollment is closed</Text>
            <Text style={s.closedText}>{CLOSED_MESSAGE}</Text>
          </View>
          <TouchableOpacity style={s.statusLink} onPress={() => router.push('/enrollment-status')}>
            <Text style={s.statusLinkText}>{'Already applied? Check your status \u2192'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── School Header ── */}
        {renderHeader()}

        {loadingSettings ? (
          <View style={s.noticeCard}>
            <ActivityIndicator color={C.primary} />
            <Text style={s.noticeText}>Loading enrollment settings...</Text>
          </View>
        ) : enrollmentSettings?.term ? (
          <View style={s.noticeCard}>
            <Text style={s.noticeTitle}>Enrollment is open</Text>
            <Text style={s.noticeText}>
              {enrollmentSettings.term.semester.toUpperCase()} Semester, A.Y. {enrollmentSettings.term.school_year}
              {enrollmentSettings.term.exam_date ? ` - Exam: ${enrollmentSettings.term.exam_date}` : ''}
            </Text>
          </View>
        ) : null}

        {/* ── Requirements Checklist ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>📋 Requirements Checklist</Text>
          <Text style={s.sectionSubtitle}>Bring originals and photocopies upon enrollment</Text>
          <View style={s.reqGrid}>
            {REQUIREMENTS.map(r => (
              <View key={r} style={s.reqItem}>
                <Text style={s.reqBullet}>[ ]</Text>
                <Text style={s.reqText}>{r}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.attachBtn} onPress={pickDocuments}>
            <Text style={s.attachBtnText}>Attach requirement photos</Text>
          </TouchableOpacity>
          {documents.length ? (
            <View style={s.docList}>
              {documents.map((doc, index) => (
                <View key={`${doc.uri}-${index}`} style={s.docItem}>
                  <Text style={s.docName} numberOfLines={1}>{doc.fileName || `Document ${index + 1}`}</Text>
                  <TouchableOpacity onPress={() => setDocuments(current => current.filter((_, i) => i !== index))}>
                    <Text style={s.docRemove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Student Classification ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Student Classification</Text>
          {STUDENT_TYPE_OPTIONS.map(option => (
            <CheckItem key={option.value} label={option.label} value={option.value} />
          ))}
          {form.student_type === 'shiftee' && (
            <View style={s.shifteeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>From</Text>
                {inp('shiftee_from', { placeholder: 'Previous program' })}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>To</Text>
                {inp('shiftee_to', { placeholder: 'New program' })}
              </View>
            </View>
          )}
          <Field label="I.D. No.">
            {inp('id_no', { placeholder: 'Student ID number' })}
          </Field>
          {form.student_type === 'old_student' && (
            <>
              <TouchableOpacity
                style={s.lookupBtn}
                onPress={handleLookupStudent}
                disabled={lookupLoading}
              >
                {lookupLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.lookupBtnText}>Lookup Existing Student</Text>
                }
              </TouchableOpacity>
              {lookupMessage ? <Text style={s.lookupMessage}>{lookupMessage}</Text> : null}
              {existingStudent ? (
                <View style={s.lookupResult}>
                  <Text style={s.lookupResultText}>
                    Matched student: {existingStudent.student_id} · {existingStudent.first_name} {existingStudent.last_name}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ── Academic Information ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Academic Information</Text>

          <PillRow label="Academic Status *" field="academic_status" options={['Regular', 'Irregular']} />
          <PillRow label="Program Type *"    field="program_type"    options={['college', 'shs']} />

          {/* Grade Level (SHS) or Year Level (College) */}
          <Field label={isSHS ? 'Grade Level *' : 'Year Level *'}>
            <View style={s.pillRow}>
              {(isSHS ? ['Grade 11', 'Grade 12'] : YEAR_LEVELS).map(opt => (
                <Pill key={opt} field="year_level" opt={opt} />
              ))}
            </View>
          </Field>

          {/* Strand (SHS) or Course dropdown (College) */}
          {isSHS ? (
            <PillRow label="Strand *" field="strand" options={SHS_STRANDS} />
          ) : (
            <Field label="Course / Program *">
              <TouchableOpacity
                style={[s.dropdown, form.course_id && s.dropdownActive]}
                onPress={() => setCourseDropdownOpen(open => !open)}
              >
                <View style={s.dropdownLabelGroup}>
                  <Text style={s.dropdownLabel}>
                    {form.course_id
                      ? (courses.find(course => course.id === form.course_id)?.acronym || courseCodeFromName(form.course_program))
                      : 'Select course'}
                  </Text>
                  <Text style={s.dropdownValue} numberOfLines={1}>
                    {form.course_program || 'Tap to choose from the list'}
                  </Text>
                </View>
                <Text style={s.dropdownArrow}>{courseDropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {courseDropdownOpen && (
                <View style={s.dropdownPanel}>
                  <TextInput
                    style={[s.input, s.courseSearchInput]}
                    value={courseSearch}
                    onChangeText={setCourseSearch}
                    placeholder="Search course list..."
                    placeholderTextColor={C.muted}
                    autoCorrect={false}
                  />
                  {loadingCourses ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : courses.length ? (
                    <ScrollView
                      style={s.dropdownScroll}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {courses.map(course => (
                        <TouchableOpacity
                          key={course.id}
                          style={[s.courseOption, form.course_id === course.id && s.courseOptionActive]}
                          onPress={() => {
                            set('course_id', course.id);
                            set('course_program', course.name);
                            setCourseDropdownOpen(false);
                          }}
                        >
                          <View style={s.courseOptionLeft}>
                            <View style={s.courseCodeBadge}>
                              <Text style={s.courseCodeText}>{course.acronym || courseCodeFromName(course.name)}</Text>
                            </View>
                            <View style={s.courseOptionText}>
                              <Text style={s.courseOptionName}>{course.name}</Text>
                              <Text style={s.courseOptionMeta}>{course.acronym ? `College • ${course.acronym}` : 'College'}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={s.helperText}>No managed courses match your search.</Text>
                  )}
                </View>
              )}
            </Field>
          )}

          <PillRow label="Semester" field="semester" options={SEMESTERS} />
          <Field label="School Year">
            {inp('school_year', { placeholder: 'e.g. 2024-2025' })}
          </Field>

          {form.academic_status === 'Regular' && (
            <Field label="Section *">
              <TouchableOpacity
                style={[s.dropdown, form.section_id && s.dropdownActive]}
                onPress={() => setSectionDropdownOpen(open => !open)}
              >
                <View style={s.dropdownLabelGroup}>
                  <Text style={s.dropdownLabel}>
                    {form.section_name || 'Select section'}
                  </Text>
                  <Text style={s.dropdownValue} numberOfLines={1}>
                    {form.section_id
                      ? 'Regular subjects will be loaded from this section'
                      : 'Choose an available section for your regular load'}
                  </Text>
                </View>
                <Text style={s.dropdownArrow}>{sectionDropdownOpen ? '^' : 'v'}</Text>
              </TouchableOpacity>

              {sectionDropdownOpen && (
                <View style={s.dropdownPanel}>
                  {loadingSubjects ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : sections.length ? (
                    <ScrollView
                      style={s.dropdownScroll}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {sections.map(section => {
                        const maxStudents = Number(section.max_students || 0);
                        const full = maxStudents > 0 && Number(section.student_count || 0) >= maxStudents;
                        return (
                          <TouchableOpacity
                            key={section.id}
                            style={[s.courseOption, form.section_id === section.id && s.courseOptionActive, full && s.optionDisabled]}
                            disabled={full}
                            onPress={() => {
                              const sectionSubjects = (section.section_subjects || [])
                                .map(offering => ({
                                  ...offering.subject,
                                  offering_id: offering.id,
                                  section_id: section.id,
                                  section_name: section.name,
                                  teacher: offering.teacher?.name,
                                  days: offering.day,
                                  time: [offering.time_start, offering.time_end].filter(Boolean).join('-'),
                                  time_start: offering.time_start,
                                  time_end: offering.time_end,
                                  room: offering.room,
                                }))
                                .filter(subject => subject?.id);

                              setSubjects(sectionSubjects);
                              setForm(prev => ({
                                ...prev,
                                section_id: section.id,
                                section_name: section.name,
                                subject_ids: sectionSubjects.map(subject => subject.id),
                                section_subject_ids: sectionSubjects.map(subject => subject.offering_id).filter(Boolean),
                              }));
                              setSectionDropdownOpen(false);
                            }}
                          >
                            <View style={s.courseOptionLeft}>
                              <View style={s.courseCodeBadge}>
                                <Text style={s.courseCodeText}>{section.name?.slice(0, 4) || 'SEC'}</Text>
                              </View>
                              <View style={s.courseOptionText}>
                                <Text style={s.courseOptionName}>{section.name}</Text>
                                <Text style={s.courseOptionMeta}>
                                  {maxStudents > 0
                                    ? `${Number(section.student_count || 0)}/${maxStudents} students`
                                    : `${Number(section.student_count || 0)} students`}
                                  {full ? ' - Full' : ''}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={s.helperText}>No available sections match this program, level, term, and course/strand.</Text>
                  )}
                </View>
              )}
            </Field>
          )}
        </View>

        {/* ── Personal Information ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Personal Information</Text>

          <View style={s.row3}>
            <View style={{ flex: 1.2 }}>
              <Text style={s.inputLabel}>Surname *</Text>
              {inp('surname')}
            </View>
            <View style={{ flex: 1.2 }}>
              <Text style={s.inputLabel}>First Name *</Text>
              {inp('first_name')}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Middle Name</Text>
              {inp('middle_name')}
            </View>
          </View>

          <Text style={[s.inputLabel, { marginTop: 12 }]}>Date of Birth</Text>
          <View style={s.row3}>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Year</Text>
              {inp('year_born', { keyboardType: 'numeric', placeholder: 'YYYY', maxLength: 4 })}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Month</Text>
              {inp('month_born', { keyboardType: 'numeric', placeholder: 'MM', maxLength: 2 })}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Day</Text>
              {inp('day_born', { keyboardType: 'numeric', placeholder: 'DD', maxLength: 2 })}
            </View>
          </View>

          <View style={s.row3}>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Sex</Text>
              <View style={s.pillRow}>
                {SEXES.map(opt => <Pill key={opt} field="sex" opt={opt} />)}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Religion</Text>
              {inp('religion')}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Civil Status</Text>
              <View style={s.pillRow}>
                {CIVIL_STATUSES.map(opt => <Pill key={opt} field="civil_status" opt={opt} />)}
              </View>
            </View>
          </View>

          <Field label="Citizenship">
            {renderSelectDropdown('citizenship', CITIZENSHIPS, 'Select citizenship')}
          </Field>
          <Field label="Mobile Number">
            {inp('mobile_no', { keyboardType: 'phone-pad', placeholder: '+63' })}
          </Field>
          <Field label="Place of Birth">
            {inp('place_of_birth')}
          </Field>
          <Field label="Home Address">
            <Text style={s.addressLabel}>Region</Text>
            {renderSelectDropdown('region', Object.keys(PH_REGIONS), 'Select region', (value) => setForm(prev => ({
                ...prev,
                region: value,
                province: '',
                city: '',
                barangay: '',
                purok: '',
                home_address: '',
              })))}
            {!!form.region && (
              <>
                <Text style={s.addressLabel}>Province</Text>
                {renderSelectDropdown('province', PH_REGIONS[form.region] || [], 'Select province', (value) => setForm(prev => ({
                    ...prev,
                    province: value,
                    city: '',
                    barangay: '',
                    purok: '',
                    home_address: '',
                  })))}
              </>
            )}
            {!!form.province && (
              <>
                <Text style={s.addressLabel}>City / Municipality</Text>
                {cityOptions.length ? (
                  renderSelectDropdown('city', cityOptions, 'Select city or municipality', (value) => setForm(prev => ({
                      ...prev,
                      city: value,
                      barangay: '',
                      purok: '',
                      home_address: '',
                    })))
                ) : (
                  <TextInput
                    style={s.input}
                    value={form.city}
                    placeholder="e.g. Cebu City, Davao City, Tagbilaran"
                    onChangeText={value => setForm(prev => ({
                      ...prev,
                      city: value,
                      barangay: '',
                      purok: '',
                      home_address: '',
                    }))}
                  />
                )}
              </>
            )}
            {!!form.city && (
              <>
                <Text style={s.addressLabel}>Barangay</Text>
                {barangayOptions.length ? (
                  renderSelectDropdown('barangay', barangayOptions, 'Select barangay', (value) => setForm(prev => ({
                      ...prev,
                      barangay: value,
                      purok: '',
                      home_address: '',
                    })))
                ) : (
                  <TextInput
                    style={s.input}
                    value={form.barangay}
                    placeholder="e.g. Lahug, Poblacion, San Isidro"
                    onChangeText={value => setForm(prev => ({
                      ...prev,
                      barangay: value,
                      purok: '',
                      home_address: '',
                    }))}
                  />
                )}
              </>
            )}
            {!!form.barangay && (
              <>
                <Text style={s.addressLabel}>Purok / Sitio / Zone</Text>
                <TextInput
                  style={s.input}
                  value={form.purok}
                  placeholder="e.g. Purok 3, Sitio Riverside, Zone 2"
                  onChangeText={value => setForm(prev => ({ ...prev, purok: value, home_address: '' }))}
                />
              </>
            )}
            <Text style={s.helperText}>
              {[form.purok, form.barangay, form.city, form.province, form.region].filter(Boolean).join(', ') || 'Select region and province, then enter city/municipality, barangay, and purok/sitio/zone.'}
            </Text>
          </Field>
          <Field label="Specific House / Street / Block">
            {inp('home_address', { placeholder: 'Optional: house no., street, subdivision, block/lot' })}
            {!!form.home_address && (
              <Text style={s.helperText}>
                {[form.home_address, form.purok, form.barangay, form.city, form.province, form.region].filter(Boolean).join(', ')}
              </Text>
            )}
          </Field>
        </View>

        {/* ── Previous School ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Previous School</Text>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>School Name</Text>
              {inp('prev_school')}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>School Address</Text>
              {inp('prev_school_address')}
            </View>
          </View>
        </View>

        {/* ── Parents / Guardian ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Parents / Guardian</Text>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>{"Father's Name"}</Text>
              {inp('father_name')}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Occupation</Text>
              {inp('father_occupation')}
            </View>
          </View>
          <View style={[s.row2, { marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>{"Mother's Name / Guardian"}</Text>
              {inp('mother_name')}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Occupation</Text>
              {inp('mother_occupation')}
            </View>
          </View>
          <Field label="Parent Email">
            {inp('parent_email', {
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              placeholder: 'parent@example.com',
            })}
          </Field>
        </View>

        {/* ── Subjects Table ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>📚 Subjects to Enroll</Text>
          <Text style={s.sectionSubtitle}>
            {form.academic_status === 'Regular'
              ? `Regular load for ${form.semester} Semester, A.Y. ${form.school_year}`
              : `Select subject offerings from available sections for ${form.semester} Semester, A.Y. ${form.school_year}`}
          </Text>
          {blockedRegularSubjects.length > 0 ? (
            <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}>
              <Text style={{ color: '#991B1B', fontWeight: '700' }}>
                Prerequisites are not met for {blockedRegularSubjects.map(subject => subject.code || subject.name).join(', ')}. Those subjects cannot be selected.
              </Text>
              <TouchableOpacity
                style={{ alignSelf: 'flex-start', marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: C.primary }}
                onPress={() => set('academic_status', 'Irregular')}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Switch to Irregular subjects</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={s.tableHeader}>
            <Text style={[s.thCell, { flex: 1.4 }]}>Code</Text>
            <Text style={[s.thCell, { flex: 2.5 }]}>Description</Text>
            <Text style={[s.thCell, { flex: 0.7 }]}>Lab</Text>
            <Text style={[s.thCell, { flex: 0.7 }]}>Lec</Text>
            <Text style={[s.thCell, { flex: 1.2 }]}>Days</Text>
            <Text style={[s.thCell, { flex: 1.2 }]}>Time</Text>
            <Text style={[s.thCell, { flex: 1 }]}>Room</Text>
            {form.academic_status === 'Irregular' && <Text style={[s.thCell, { flex: 1.2 }]}>Section</Text>}
          </View>

          {loadingSubjects ? (
            <ActivityIndicator style={{ margin: 20 }} color={C.primary} />
          ) : subjects.length > 0 ? (
            <>
              {subjects.map(subject => {
                const active = form.academic_status === 'Irregular'
                  ? form.section_subject_ids.includes(subject.offering_id)
                  : form.subject_ids.includes(subject.id);
                const unmetPrerequisites = prerequisiteStatuses[subject.id] || [];
                const blockedByPrerequisite = unmetPrerequisites.length > 0;
                return (
                  <TouchableOpacity
                    key={subject.offering_id || subject.id}
                    style={[s.tableRow, active && s.tableRowActive, blockedByPrerequisite && { opacity: 0.55 }]}
                    onPress={() => toggleSubject(subject)}
                    disabled={form.academic_status === 'Regular' || blockedByPrerequisite}
                  >
                    <View style={[s.checkBox, { marginRight: 6 }, active && s.checkBoxActive]}>
                      {active && <Text style={s.checkMark}>✓</Text>}
                    </View>
                    <Text style={[s.tdCell, { flex: 1.2 }]}>{subject.code}</Text>
                    <View style={{ flex: 2.5 }}>
                      <Text style={s.tdCell}>{subject.name}</Text>
                      {blockedByPrerequisite ? (
                        <Text style={{ marginTop: 3, color: '#B91C1C', fontSize: 11, fontWeight: '600' }}>
                          Prerequisite not met: {unmetPrerequisites.map(item => item.code || item.name).join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[s.tdCell, { flex: 0.7 }]}>{subject.units_lab ?? '-'}</Text>
                    <Text style={[s.tdCell, { flex: 0.7 }]}>{subject.units_lec ?? '-'}</Text>
                    <Text style={[s.tdCell, { flex: 1.2 }]}>{subject.days ?? '-'}</Text>
                    <Text style={[s.tdCell, { flex: 1.2 }]}>{subject.time ?? '-'}</Text>
                    <Text style={[s.tdCell, { flex: 1 }]}>{subject.room ?? '-'}</Text>
                    {form.academic_status === 'Irregular' && <Text style={[s.tdCell, { flex: 1.2 }]}>{subject.section_name ?? '-'}</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total Number of Units</Text>
                <Text style={s.totalValue}>{totalUnits}</Text>
              </View>
            </>
          ) : (
            <Text style={s.emptyText}>
              {isSHS && !form.strand
                ? 'Select a strand first to view available subjects.'
                : !isSHS && !form.course_id
                ? 'Select a course first to view available subjects.'
                : 'No subjects available for this program.'}
            </Text>
          )}
        </View>

        {/* ── Account ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Account</Text>
          <Text style={s.sectionSubtitle}>This enrollment will be submitted using your registered account.</Text>

          <Field label="Email Address *">
            <TextInput
              style={s.input}
              value={authenticatedUser?.email || form.email}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
            />
          </Field>
          {existingStudent ? (
            <Text style={s.helperText}>
              Existing student account found. Login email will be linked to the current student record.
            </Text>
          ) : (
            <Text style={s.helperText}>
              Account credentials are managed from registration and profile settings.
            </Text>
          )}
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity style={[s.submitBtn, (!enrollmentSettings?.enrollment_open || loadingSettings) && s.submitBtnDisabled]} onPress={handleSubmit} disabled={loading || loadingSettings || !enrollmentSettings?.enrollment_open}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnText}>Submit Application</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.statusLink} onPress={() => router.push('/enrollment-status')}>
          <Text style={s.statusLinkText}>{'Already applied? Check your status \u2192'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  body: { padding: 16, paddingBottom: 100 },
  closedBody: { flexGrow: 1, justifyContent: 'center' },

  schoolHeader: {
    alignItems: 'center', backgroundColor: C.card,
    padding: 20, borderRadius: 12, marginBottom: 16,
    borderBottomWidth: 3, borderBottomColor: C.primary,
  },
  schoolName: { fontSize: 17, fontWeight: '800', color: C.primary, textAlign: 'center' },
  schoolSub:  { fontSize: 12, color: C.subtext, marginTop: 2 },
  deptName:   { fontSize: 14, fontWeight: '700', color: C.primary, marginTop: 6, textTransform: 'uppercase' },
  formTitle:  { fontSize: 20, fontWeight: '800', color: C.accent, marginTop: 4 },
  ayLine:     { fontSize: 13, color: C.muted, marginTop: 4 },

  card: {
    backgroundColor: C.card, borderRadius: 16,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: C.border,
  },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: C.primary, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: C.subtext, marginBottom: 12 },
  noticeCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B8C7E6',
    padding: 14,
    marginBottom: 14,
    gap: 6,
  },
  noticeTitle: { fontSize: 14, fontWeight: '800', color: C.primary },
  noticeText: { fontSize: 13, color: C.subtext, fontWeight: '600', lineHeight: 18 },
  closedCard: {
    backgroundColor: '#FFF3F3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7B8B8',
    padding: 14,
    marginBottom: 14,
  },
  closedTitle: { fontSize: 14, fontWeight: '800', color: C.accent },
  closedText: { fontSize: 13, color: C.subtext, marginTop: 5, lineHeight: 18 },

  reqGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  reqItem:   { flexDirection: 'row', alignItems: 'center', width: '50%', paddingVertical: 3 },
  reqBullet: { fontSize: 12, color: C.muted, marginRight: 6, fontFamily: 'monospace' },
  reqText:   { fontSize: 12, color: C.subtext, flex: 1 },
  attachBtn:     { borderWidth: 1, borderColor: C.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  attachBtnText: { color: C.primary, fontSize: 14, fontWeight: '700' },
  docList:       { marginTop: 10, gap: 8 },
  docItem:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FBFAF7', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  docName:       { flex: 1, color: C.text, fontSize: 13, marginRight: 10 },
  docRemove:     { color: C.accent, fontSize: 12, fontWeight: '800' },

  checkRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkBox:      { width: 22, height: 22, borderWidth: 2, borderColor: C.border, borderRadius: 5, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkBoxActive:{ backgroundColor: C.primary, borderColor: C.primary },
  checkMark:     { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  checkLabel:    { fontSize: 15, color: C.text },
  shifteeRow:    { flexDirection: 'row', gap: 10, marginLeft: 32, marginBottom: 8 },

  fieldWrap:  { marginTop: 10 },
  inputLabel: { fontSize: 13, color: C.subtext, fontWeight: '600', marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: C.text, backgroundColor: '#FBFAF7',
  },

  row3: { flexDirection: 'row', gap: 8, marginTop: 10 },
  row2: { flexDirection: 'row', gap: 8 },

  pillRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill:          { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.border, borderRadius: 20, backgroundColor: '#FBFAF7' },
  pillActive:    { borderColor: C.primary, backgroundColor: '#EEF4FF' },
  pillText:      { fontSize: 14, color: C.subtext, fontWeight: '500' },
  pillTextActive:{ color: C.primary, fontWeight: '700' },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip:          { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8, marginBottom: 8, backgroundColor: '#FBFAF7' },
  chipActive:    { borderColor: C.primary, backgroundColor: '#EEF4FF' },
  chipText:      { fontSize: 14, color: C.subtext },
  chipTextActive:{ color: C.primary, fontWeight: '700' },
  addressLabel: { fontSize: 12, color: C.subtext, fontWeight: '800', marginTop: 10, marginBottom: 2 },
  dropdown:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: '#FBFAF7', padding: 12, marginTop: 4 },
  dropdownActive:{ borderColor: C.primary },
  dropdownLabelGroup: { flex: 1, paddingRight: 8 },
  dropdownLabel:  { fontSize: 14, fontWeight: '700', color: C.primary },
  dropdownValue:  { fontSize: 13, color: C.subtext, marginTop: 4 },
  dropdownArrow:  { fontSize: 16, color: C.subtext },
  dropdownPanel:  { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: '#FFFFFF', marginTop: 8, overflow: 'hidden' },
  dropdownScroll: { maxHeight: 220 },
  courseOption:   { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F0EDE6' },
  courseOptionActive: { backgroundColor: '#EEF4FF' },
  optionDisabled: { opacity: 0.45 },
  courseOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseCodeBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E8F0FF', justifyContent: 'center', alignItems: 'center' },
  courseCodeText:  { fontSize: 13, fontWeight: '700', color: C.blue },
  courseOptionText: { flex: 1 },
  courseOptionName: { fontSize: 14, fontWeight: '700', color: C.text },
  courseOptionMeta: { fontSize: 12, color: C.subtext, marginTop: 2 },
  courseSearchInput: { marginTop: 4, marginBottom: 8 },
  helperText:    { color: C.muted, fontSize: 13, marginTop: 8 },

  tableHeader:   { flexDirection: 'row', backgroundColor: C.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6, marginBottom: 4 },
  thCell:        { fontSize: 11, color: '#fff', fontWeight: '700', textAlign: 'center' },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#F0EBE0', backgroundColor: '#FBFAF7', borderRadius: 6, marginBottom: 3 },
  tableRowActive:{ backgroundColor: '#EEF4FF', borderColor: C.primary, borderWidth: 1 },
  tdCell:        { fontSize: 12, color: C.text, textAlign: 'center' },
  totalRow:      { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 10, paddingHorizontal: 6, borderTopWidth: 1.5, borderTopColor: C.primary, marginTop: 6 },
  totalLabel:    { fontSize: 13, fontWeight: '700', color: C.primary, marginRight: 12 },
  totalValue:    { fontSize: 16, fontWeight: '800', color: C.accent },
  emptyText:     { fontSize: 14, color: C.muted, textAlign: 'center', paddingVertical: 20 },

  lookupBtn:     { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginTop: 10, marginBottom: 8 },
  lookupBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lookupMessage: { fontSize: 13, color: C.accent, marginBottom: 8, fontStyle: 'italic' },
  lookupResult:  { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 4, borderLeftColor: C.accent },
  lookupResultText: { fontSize: 13, color: C.text, fontWeight: '600' },

  submitBtn:     { backgroundColor: C.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { backgroundColor: C.muted },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusLink:    { alignItems: 'center', marginTop: 20 },
  statusLinkText:{ color: C.primary, fontSize: 14, fontWeight: '600' },
});
