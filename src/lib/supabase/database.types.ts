
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assignments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"instructions": string,"lesson_id": string | null,"module_id": string | null,"rubric": NonNullable<Json>,"status": Database["public"]['Enums']["content_status"],"title": string,"type": Database["public"]['Enums']["assignment_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"instructions"?: string,"lesson_id"?: string | null,"module_id"?: string | null,"rubric"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["content_status"],"title": string,"type": Database["public"]['Enums']["assignment_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"instructions"?: string,"lesson_id"?: string | null,"module_id"?: string | null,"rubric"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"type"?: Database["public"]['Enums']["assignment_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"metadata": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_user_id_fkey"
      columns: ["actor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cohort_members": {
                  Row: {
                    "cohort_id": string,"created_at": string,"id": string,"status": string,"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cohort_id": string,"created_at"?: string,"id"?: string,"status"?: string,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cohort_id"?: string,"created_at"?: string,"id"?: string,"status"?: string,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohort_members_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cohort_members_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cohorts": {
                  Row: {
                    "course_id": string,"created_at": string,"ends_on": string | null,"id": string,"name": string,"starts_on": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"name": string,"starts_on"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"name"?: string,"starts_on"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cohorts_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"slug": string,"status": Database["public"]['Enums']["content_status"],"title": string,"title_ar": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"title": string,"title_ar"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"title_ar"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"lesson_blocks": {
                  Row: {
                    "authoring_type": Database["public"]['Enums']["authoring_type"],"block_type": Database["public"]['Enums']["block_type"],"body": NonNullable<Json>,"created_at": string,"id": string,"lesson_id": string,"locale": string | null,"position": number,"source_reference_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "authoring_type"?: Database["public"]['Enums']["authoring_type"],"block_type": Database["public"]['Enums']["block_type"],"body"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"lesson_id": string,"locale"?: string | null,"position": number,"source_reference_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "authoring_type"?: Database["public"]['Enums']["authoring_type"],"block_type"?: Database["public"]['Enums']["block_type"],"body"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"lesson_id"?: string,"locale"?: string | null,"position"?: number,"source_reference_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_blocks_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_blocks_source_reference_id_fkey"
      columns: ["source_reference_id"]
isOneToOne: false
      referencedRelation: "source_references"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "created_at": string,"estimated_minutes": number | null,"id": string,"module_id": string,"objectives": NonNullable<Json>,"position": number,"published_at": string | null,"source_audit_status": Database["public"]['Enums']["source_audit_status"],"status": Database["public"]['Enums']["content_status"],"title": string,"title_ar": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"estimated_minutes"?: number | null,"id"?: string,"module_id": string,"objectives"?: NonNullable<Json>,"position": number,"published_at"?: string | null,"source_audit_status"?: Database["public"]['Enums']["source_audit_status"],"status"?: Database["public"]['Enums']["content_status"],"title": string,"title_ar"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"estimated_minutes"?: number | null,"id"?: string,"module_id"?: string,"objectives"?: NonNullable<Json>,"position"?: number,"published_at"?: string | null,"source_audit_status"?: Database["public"]['Enums']["source_audit_status"],"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"title_ar"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "course_id": string,"created_at": string,"description": string,"id": string,"position": number,"status": Database["public"]['Enums']["content_status"],"title": string,"title_ar": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"description"?: string,"id"?: string,"position": number,"status"?: Database["public"]['Enums']["content_status"],"title": string,"title_ar"?: string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"position"?: number,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"title_ar"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modules_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"email": string,"id": string,"locale": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"email": string,"id": string,"locale"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"email"?: string,"id"?: string,"locale"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quiz_answer_keys": {
                  Row: {
                    "correct_options": NonNullable<Json>,"question_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct_options": NonNullable<Json>,"question_id": string,"updated_at"?: string
                  }
                  Update: {
                    "correct_options"?: NonNullable<Json>,"question_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_answer_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "assignment_id": string,"created_at": string,"id": string,"options": NonNullable<Json>,"points": number,"position": number,"prompt": string,"type": Database["public"]['Enums']["question_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"created_at"?: string,"id"?: string,"options": NonNullable<Json>,"points"?: number,"position": number,"prompt": string,"type"?: Database["public"]['Enums']["question_type"],"updated_at"?: string
                  }
                  Update: {
                    "assignment_id"?: string,"created_at"?: string,"id"?: string,"options"?: NonNullable<Json>,"points"?: number,"position"?: number,"prompt"?: string,"type"?: Database["public"]['Enums']["question_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_questions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    }
                  ]
                },"source_references": {
                  Row: {
                    "author": string,"created_at": string,"created_by": string | null,"edition": string,"id": string,"notes": string,"page_or_section": string,"rights_status": Database["public"]['Enums']["rights_status"],"title": string,"updated_at": string,"verification_status": Database["public"]['Enums']["verification_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "author"?: string,"created_at"?: string,"created_by"?: string | null,"edition"?: string,"id"?: string,"notes"?: string,"page_or_section"?: string,"rights_status"?: Database["public"]['Enums']["rights_status"],"title": string,"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["verification_status"]
                  }
                  Update: {
                    "author"?: string,"created_at"?: string,"created_by"?: string | null,"edition"?: string,"id"?: string,"notes"?: string,"page_or_section"?: string,"rights_status"?: Database["public"]['Enums']["rights_status"],"title"?: string,"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["verification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_references_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_assignments": {
                  Row: {
                    "active": boolean,"cohort_id": string | null,"created_at": string,"created_by": string | null,"id": string,"student_id": string | null,"teacher_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"cohort_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"student_id"?: string | null,"teacher_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"cohort_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"student_id"?: string | null,"teacher_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_assignments_cohort_id_fkey"
      columns: ["cohort_id"]
isOneToOne: false
      referencedRelation: "cohorts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "app_role": "student"|"teacher"|"admin","assignment_type": "quiz"|"audio"|"written","authoring_type": "source"|"authored","block_type": "text"|"arabic"|"table"|"makhraj"|"sifat"|"mastery","content_status": "draft"|"published"|"archived","question_type": "single_choice"|"multiple_choice","rights_status": "unknown"|"permitted"|"restricted"|"own","source_audit_status": "pending"|"in_review"|"verified"|"not_required","verification_status": "pending"|"verified"|"rejected"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["student", "teacher", "admin"],"assignment_type": ["quiz", "audio", "written"],"authoring_type": ["source", "authored"],"block_type": ["text", "arabic", "table", "makhraj", "sifat", "mastery"],"content_status": ["draft", "published", "archived"],"question_type": ["single_choice", "multiple_choice"],"rights_status": ["unknown", "permitted", "restricted", "own"],"source_audit_status": ["pending", "in_review", "verified", "not_required"],"verification_status": ["pending", "verified", "rejected"]
          }
        }
} as const
