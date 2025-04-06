import React, { useEffect, useState } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';

const meals = ['早', '中', '晚'];

const MealPlanner = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [plans, setPlans] = useState([]);
  const startDay = startOfWeek(currentWeek, { weekStartsOn: 1 });

  useEffect(() => {
    fetchPlans();
  }, [currentWeek]);

  const fetchPlans = async () => {
    const { data, error } = await supabase.from('meal_plan').select('*');
    if (!error) setPlans(data);
    else console.error('查询失败:', error);
  };

  const updatePlan = async (user_name, meal_date, meal_type) => {
    const input = prompt('请输入用餐人数（输入 0 表示删除该计划）:', '1');
    const meal_count = parseInt(input, 10);
    if (isNaN(meal_count)) return;

    if (meal_count === 0) {
      await supabase
        .from('meal_plan')
        .delete()
        .match({ user_name, meal_date, meal_type });
    } else {
      await supabase.from('meal_plan').upsert({ user_name, meal_date, meal_type, meal_count });
    }
    fetchPlans();
  };

  const deleteUser = async (user_name) => {
    if (!window.confirm(`是否删除 ${user_name} 的所有报餐计划？`)) return;
    await supabase.from('meal_plan').delete().eq('user_name', user_name);
    fetchPlans();
  };

  const totalMealCount = (day, meal_type) =>
    plans
      .filter(p => p.meal_date === format(day, 'yyyy-MM-dd') && p.meal_type === meal_type)
      .reduce((sum, p) => sum + p.meal_count, 0);

  const uniqueUsers = Array.from(new Set(plans.map(p => p.user_name)));

  return (
    <div className="p-6 font-sans max-w-full overflow-x-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">升龙公司德合厂用餐计划表</h2>

      <div className="flex items-center justify-between mb-6">
        <ChevronLeft className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, -7))} />
        <span className="text-xl font-semibold">
          {format(startDay, 'dd/MM/yyyy')} - {format(addDays(startDay, 6), 'dd/MM/yyyy')}
        </span>
        <ChevronRight className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} />
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2" rowSpan={2}>姓名</th>
            <th className="border p-2" rowSpan={2}>操作</th>
            {[...Array(7)].map((_, idx) => (
              <th key={idx} className="border p-2" colSpan={3}>
                {format(addDays(startDay, idx), 'dd/MM EEE', { locale: zhCN })}
              </th>
            ))}
          </tr>
          <tr>
            {[...Array(7)].map((_, idx) => meals.map(meal => (
              <th key={`${idx}-${meal}`} className="border p-1 bg-gray-50">{meal}</th>
            )))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((name, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border p-2 font-medium">{name}</td>
              <td className="border p-2 text-red-500 cursor-pointer" onClick={() => deleteUser(name)}>
                <Trash2 size={16} />
              </td>
              {[...Array(7)].map((_, dayIdx) =>
                meals.map(meal => {
                  const day = format(addDays(startDay, dayIdx), 'yyyy-MM-dd');
                  const record = plans.find(p => p.user_name === name && p.meal_date === day && p.meal_type === meal);
                  return (
                    <td
                      key={`${dayIdx}-${meal}`}
                      className="border p-1 cursor-pointer hover:bg-blue-50"
                      onClick={() => updatePlan(name, day, meal)}
                    >
                      {record?.meal_count || '-'}
                    </td>
                  );
                })
              )}
            </tr>
          ))}

          <tr className="bg-gray-200 font-bold">
            <td className="border p-2" colSpan={2}>合计人数</td>
            {[...Array(7)].map((_, dayIdx) =>
              meals.map((meal) => (
                <td key={`total-${dayIdx}-${meal}`} className="border p-1">
                  {totalMealCount(addDays(startDay, dayIdx), meal)}
                </td>
              ))
            )}
          </tr>
        </tbody>
      </table>

      <button
        className="mt-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        onClick={() => {
          const user = prompt('请输入您的姓名');
          if (user) updatePlan(user, format(new Date(), 'yyyy-MM-dd'), '早');
        }}
      >
        添加 / 修改 报餐计划
      </button>
    </div>
  );
};

export default MealPlanner;
