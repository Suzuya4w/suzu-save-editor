#[cfg(target_os = "android")]
use std::sync::OnceLock;
#[cfg(target_os = "android")]
use jni::{objects::{JObject, JValue, GlobalRef}, JNIEnv, JavaVM};

#[cfg(target_os = "android")]
static SHIZUKU_VM: OnceLock<JavaVM> = OnceLock::new();
#[cfg(target_os = "android")]
static SHIZUKU_CONTEXT: OnceLock<GlobalRef> = OnceLock::new();
#[cfg(target_os = "android")]
#[cfg(target_os = "android")]
static SHIZUKU_API_CLASS: OnceLock<GlobalRef> = OnceLock::new();
#[cfg(target_os = "android")]
static SAF_API_CLASS: OnceLock<GlobalRef> = OnceLock::new();

#[unsafe(no_mangle)]
#[cfg(target_os = "android")]
pub extern "C" fn Java_com_suzu_saveeditor_MainActivity_initShizukuJni<'local>(
    mut env: JNIEnv<'local>,
    _class: JObject<'local>,
    context: JObject<'local>,
) {
    if let Ok(vm) = env.get_java_vm() {
        let _ = SHIZUKU_VM.set(vm);
    }
    if let Ok(global_context) = env.new_global_ref(&context) {
        let _ = SHIZUKU_CONTEXT.set(global_context);
    }
    if let Ok(class) = env.find_class("com/suzu/saveeditor/ShizukuAPI") {
        if let Ok(global_class) = env.new_global_ref(class) {
            let _ = SHIZUKU_API_CLASS.set(global_class);
        }
    }
    if let Ok(class) = env.find_class("com/suzu/saveeditor/SafAPI") {
        if let Ok(global_class) = env.new_global_ref(class) {
            let _ = SAF_API_CLASS.set(global_class);
        }
    }
}

#[cfg(target_os = "android")]
pub fn get_vm() -> Result<&'static JavaVM, String> {
    SHIZUKU_VM.get().ok_or_else(|| "Shizuku VM not initialized".to_string())
}

#[cfg(target_os = "android")]
pub fn get_application_context<'a>(_env: &mut JNIEnv<'a>) -> Result<&'static JObject<'static>, String> {
    let global_ref = SHIZUKU_CONTEXT.get().ok_or_else(|| "Shizuku context not initialized".to_string())?;
    Ok(global_ref.as_obj())
}

#[cfg(target_os = "android")]
fn get_api_class<'a>(env: &mut JNIEnv<'a>) -> Result<jni::objects::JClass<'a>, String> {
    let global_class = SHIZUKU_API_CLASS.get().ok_or_else(|| "ShizukuAPI class not initialized".to_string())?;
    let local_ref = env.new_local_ref(global_class.as_obj()).map_err(|e| e.to_string())?;
    Ok(local_ref.into())
}

#[cfg(target_os = "android")]
pub fn get_saf_api_class<'a>(env: &mut JNIEnv<'a>) -> Result<jni::objects::JClass<'a>, String> {
    let global_class = SAF_API_CLASS.get().ok_or_else(|| "SafAPI class not initialized".to_string())?;
    let local_ref = env.new_local_ref(global_class.as_obj()).map_err(|e| e.to_string())?;
    Ok(local_ref.into())
}

#[cfg(target_os = "android")]
pub fn is_available() -> Result<bool, String> {
    let vm = get_vm()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let class = get_api_class(&mut env)?;
    let result = env.call_static_method(class, "isAvailable", "()Z", &[]).map_err(|e| e.to_string())?;
    result.z().map_err(|e| e.to_string())
}

#[cfg(target_os = "android")]
pub fn check_permission() -> Result<bool, String> {
    let vm = get_vm()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let class = get_api_class(&mut env)?;
    let result = env.call_static_method(class, "checkPermission", "()Z", &[]).map_err(|e| e.to_string())?;
    result.z().map_err(|e| e.to_string())
}

#[cfg(target_os = "android")]
pub fn request_permission() -> Result<(), String> {
    let vm = get_vm()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let class = get_api_class(&mut env)?;
    env.call_static_method(class, "requestPermission", "()V", &[]).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "android")]
pub fn execute_command(cmd: &str) -> Result<String, String> {
    let vm = get_vm()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let class = get_api_class(&mut env)?;
    let j_cmd = env.new_string(cmd).map_err(|e| e.to_string())?;
    let result = env.call_static_method(
        class, 
        "executeCommand", 
        "(Ljava/lang/String;)Ljava/lang/String;", 
        &[JValue::Object(&j_cmd.into())]
    ).map_err(|e| e.to_string())?;
    
    let j_str = result.l().map_err(|e| e.to_string())?.into();
    let r_str: String = env.get_string(&j_str).map_err(|e| e.to_string())?.into();
    if r_str.starts_with("ERROR:") {
        return Err(r_str);
    }
    Ok(r_str)
}

#[cfg(target_os = "android")]
pub fn open_manager() -> Result<(), String> {
    let vm = get_vm()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context_obj = get_application_context(&mut env)?;
    
    let class = get_api_class(&mut env)?;
    env.call_static_method(
        class, 
        "openManager", 
        "(Landroid/content/Context;)V", 
        &[JValue::Object(context_obj)]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "android")]
pub fn get_status() -> Result<String, String> {
    let vm = get_vm()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context_obj = get_application_context(&mut env)?;
    
    let class = get_api_class(&mut env)?;
    let result = env.call_static_method(
        class, 
        "getStatus", 
        "(Landroid/content/Context;)Ljava/lang/String;", 
        &[jni::objects::JValue::Object(context_obj)]
    ).map_err(|e| e.to_string())?;
    
    let j_str = result.l().map_err(|e| e.to_string())?.into();
    let r_str: String = env.get_string(&j_str).map_err(|e| e.to_string())?.into();
    Ok(r_str)
}

// Fallback dummy implementations for non-Android targets
#[cfg(not(target_os = "android"))]
pub fn is_available() -> Result<bool, String> { Ok(false) }

#[cfg(not(target_os = "android"))]
pub fn check_permission() -> Result<bool, String> { Ok(false) }

#[cfg(not(target_os = "android"))]
pub fn request_permission() -> Result<(), String> { Ok(()) }

#[cfg(not(target_os = "android"))]
pub fn execute_command(_cmd: &str) -> Result<String, String> { Err("Shizuku is only available on Android".to_string()) }

#[cfg(not(target_os = "android"))]
pub fn open_manager() -> Result<(), String> { Ok(()) }

#[cfg(not(target_os = "android"))]
pub fn get_status() -> Result<String, String> { Ok("NOT_ANDROID".to_string()) }
